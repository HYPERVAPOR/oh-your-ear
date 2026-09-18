package services

import (
	"context"
	"fmt"
	"log"
	"net/smtp"
	"strings"
)

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

// NewSMTPMailer returns an SMTP mailer. Port 587 with STARTTLS is the common
// case; plaintext is only used when the relay does not advertise STARTTLS, which
// self-hosted relays on a private network sometimes do not.
func NewSMTPMailer(host, port, username, password, from string) *SMTPMailer {
	return &SMTPMailer{host: host, port: port, username: username, password: password, from: from}
}

// Send delivers one message.
func (m *SMTPMailer) Send(_ context.Context, to, subject, body string) error {
	addr := m.host + ":" + m.port
	client, err := smtp.Dial(addr)
	if err != nil {
		return fmt.Errorf("failed to reach smtp relay: %w", err)
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(nil); err != nil {
			return fmt.Errorf("failed to start tls: %w", err)
		}
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

func (m *SMTPMailer) message(to, subject, body string) string {
	headers := []string{
		"From: " + m.from,
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
	}
	return strings.Join(headers, "\r\n") + "\r\n\r\n" + body + "\r\n"
}
