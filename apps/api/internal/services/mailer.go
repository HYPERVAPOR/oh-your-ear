package services

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"strings"
	"time"

	"github.com/google/uuid"
)

// smtpTimeout bounds one delivery end to end. A relay that accepts the connection and then
// stops talking must not hold the request that triggered it: sending happens inside
// POST /auth/code, and that endpoint has to answer.
const smtpTimeout = 20 * time.Second

// Mailer delivers a message to a user.
type Mailer interface {
	Send(ctx context.Context, to, subject, body string) error
	// Driver names the delivery path, for logs and health reporting.
	Driver() string
}

// LogMailer writes messages to the server log. It is the default so the app is
// usable without mail credentials, and it is what runs in development.
type LogMailer struct{}

// NewLogMailer returns a mailer that only logs.
func NewLogMailer() *LogMailer {
	return &LogMailer{}
}

// Send logs the message.
func (m *LogMailer) Send(_ context.Context, to, subject, body string) error {
	log.Printf("[mail:log] to=%s subject=%q body=%q", to, subject, body)
	return nil
}

// Driver names this delivery path.
func (m *LogMailer) Driver() string { return "log" }

// SMTPMailer delivers through an SMTP relay over STARTTLS.
type SMTPMailer struct {
	host     string
	port     string
	username string
	password string
	from     string
}

// NewSMTPMailer returns an SMTP mailer. Port 587 with STARTTLS is the common case; port
// 465 is implicit TLS, which is what most Chinese providers call "SSL" and what several of
// them offer instead of 587.
func NewSMTPMailer(host, port, username, password, from string) *SMTPMailer {
	return &SMTPMailer{host: host, port: port, username: username, password: password, from: from}
}

// Send delivers one message.
func (m *SMTPMailer) Send(_ context.Context, to, subject, body string) error {
	client, err := m.dial()
	if err != nil {
		return err
	}
	defer client.Close()

	// Upgrade, always — unless the relay is on a private network, where there is no network
	// in between for anyone to strip the upgrade on. A public relay that does not advertise
	// STARTTLS is either misconfigured or being downgraded in transit, and either way the
	// verification code would travel in the clear.
	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: m.host, MinVersion: tls.VersionTLS12}); err != nil {
			return fmt.Errorf("failed to start tls: %w", err)
		}
	} else if !m.isPrivateRelay() {
		return fmt.Errorf("smtp relay %s does not offer STARTTLS", m.host)
	}

	if m.username != "" {
		auth := smtp.PlainAuth("", m.username, m.password, m.host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth failed: %w", err)
		}
	}

	if err := client.Mail(m.from); err != nil {
		return fmt.Errorf("smtp MAIL FROM failed: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp RCPT TO failed: %w", err)
	}

	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp DATA failed: %w", err)
	}
	if _, err := writer.Write([]byte(m.message(to, subject, body))); err != nil {
		return fmt.Errorf("smtp write failed: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("smtp send failed: %w", err)
	}

	return client.Quit()
}

// Driver names this delivery path.
func (m *SMTPMailer) Driver() string { return "smtp" }

// dial opens the connection, choosing implicit TLS for port 465 and a plain socket to be
// upgraded by STARTTLS everywhere else. One deadline covers the whole session: `net/smtp`
// has no timeout of its own, so a relay that stops mid-conversation would otherwise hang
// the request until the client gave up.
func (m *SMTPMailer) dial() (*smtp.Client, error) {
	dialer := &net.Dialer{Timeout: smtpTimeout}
	conn, err := dialer.Dial("tcp", net.JoinHostPort(m.host, m.port))
	if err != nil {
		return nil, fmt.Errorf("failed to reach smtp relay: %w", err)
	}
	if err := conn.SetDeadline(time.Now().Add(smtpTimeout)); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to set the smtp deadline: %w", err)
	}
	if m.port == "465" {
		conn = tls.Client(conn, &tls.Config{ServerName: m.host, MinVersion: tls.VersionTLS12})
	}

	client, err := smtp.NewClient(conn, m.host)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to greet the smtp relay: %w", err)
	}
	return client, nil
}

// isPrivateRelay reports whether the relay sits on loopback or a private network — the only
// places a session without TLS is acceptable.
func (m *SMTPMailer) isPrivateRelay() bool {
	ip := net.ParseIP(m.host)
	if ip == nil {
		hosts, err := net.LookupHost(m.host)
		if err != nil || len(hosts) == 0 {
			return false
		}
		ip = net.ParseIP(hosts[0])
		if ip == nil {
			return false
		}
	}
	// Link-local counts: it is the segment the host itself sits on, which is what podman's
	// `host.containers.internal` resolves to (169.254.1.2), and nothing routes it onward —
	// there is no network between the two ends to strip an upgrade on.
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast()
}

// message builds the raw message. Date and Message-ID are not decoration: a message missing
// either costs deliverability points, and for a verification code that means a code that
// never arrives.
func (m *SMTPMailer) message(to, subject, body string) string {
	headers := []string{
		"From: " + headerValue(m.from),
		"To: " + headerValue(to),
		"Subject: " + headerValue(subject),
		"Date: " + time.Now().Format(time.RFC1123Z),
		"Message-ID: " + fmt.Sprintf("<%s@%s>", uuid.NewString(), fromDomain(m.from)),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
	}
	return strings.Join(headers, "\r\n") + "\r\n\r\n" + body + "\r\n"
}

// headerValue keeps header injection out of the message: `to` is an address a caller
// supplied, and a bare CRLF in it would start headers of the caller's choosing.
func headerValue(value string) string {
	return strings.NewReplacer("\r", "", "\n", "").Replace(value)
}

// fromDomain is the domain half of a From address, used for the Message-ID. It falls back to
// "localhost" so a bare address without an @ still produces a syntactically valid ID.
func fromDomain(from string) string {
	at := strings.LastIndex(headerValue(from), "@")
	if at < 0 || at == len(from)-1 {
		return "localhost"
	}
	return strings.Trim(from[at+1:], "> ")
}
