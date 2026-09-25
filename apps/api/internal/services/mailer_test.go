package services

import (
	"bufio"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net"
	"net/mail"
	"strings"
	"testing"
	"time"
)

// fakeRelay speaks just enough SMTP to accept one message. `startTLS` decides whether it
// advertises the upgrade: the mailer only allows a session without TLS when the relay is on
// a private network, which is exactly what 127.0.0.1 is.
func fakeRelay(t *testing.T, startTLS bool) (host, port string, received chan string) {
	t.Helper()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to start the fake relay: %v", err)
	}
	t.Cleanup(func() { ln.Close() })

	addr := ln.Addr().(*net.TCPAddr)
	received = make(chan string, 1)

	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(5 * time.Second))

		reader := bufio.NewReader(conn)
		say := func(line string) { _, _ = fmt.Fprintf(conn, "%s\r\n", line) }

		say("220 fake.test ESMTP")
		var body []string
		inData := false

		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				return
			}
			line = strings.TrimRight(line, "\r\n")

			if inData {
				if line == "." {
					say("250 OK")
					received <- strings.Join(body, "\n")
					say("221 Bye")
					return
				}
				body = append(body, line)
				continue
			}

			verb := strings.ToUpper(strings.Fields(line + " ")[0])
			switch verb {
			case "EHLO", "HELO":
				say("250-fake.test")
				if startTLS {
					// Advertised, but not implemented: a relay that claims TLS and cannot
					// deliver it must abort the send rather than quietly continue.
					say("250-STARTTLS")
				}
				say("250 8BITMIME")
			case "MAIL", "RCPT":
				say("250 OK")
			case "DATA":
				say("354 End data with <CR><LF>.<CR><LF>")
				inData = true
			case "QUIT":
				say("221 Bye")
				return
			default:
				say("250 OK")
			}
		}
	}()

	return addr.IP.String(), fmt.Sprint(addr.Port), received
}

func TestSMTPMailerSendsThroughAPrivateRelay(t *testing.T) {
	host, port, received := fakeRelay(t, false)
	m := NewSMTPMailer(host, port, "", "", "no-reply@ohyourear.test")

	if err := m.Send(context.Background(), "reader@example.com", "Oh Your Ear 验证码", "code: 123456", "<p>123456</p>"); err != nil {
		t.Fatalf("send failed: %v", err)
	}

	select {
	case message := <-received:
		for _, want := range []string{
			"To: reader@example.com",
			"Date: ",
			"Message-ID: <",
			"MIME-Version: 1.0",
			"Content-Type: multipart/alternative",
		} {
			if !strings.Contains(message, want) {
				t.Errorf("the delivered message is missing %q:\n%s", want, message)
			}
		}
		// The relay above re-joins DATA lines with "\n", so the assertion is about order,
		// not about the CRLF the wire carried.
		if !strings.HasPrefix(message, "From: no-reply@ohyourear.test\n") {
			t.Errorf("the message does not start with the From header:\n%s", message)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("the relay received no message")
	}
}

// A message we build has to *parse* as MIME, not merely contain the right-looking strings:
// a broken multipart is exactly the sort of thing one mail client forgives and the next one
// shows as a wall of base64.
func TestMessageIsValidMultipart(t *testing.T) {
	m := &SMTPMailer{from: "no-reply@ohyourear.test"}
	raw := m.message("reader@example.com", "Oh Your Ear 验证码", "code: 123456", "<p>123456</p>")

	parsed, err := mail.ReadMessage(strings.NewReader(raw))
	if err != nil {
		t.Fatalf("the message does not parse: %v", err)
	}
	mediaType, params, err := mime.ParseMediaType(parsed.Header.Get("Content-Type"))
	if err != nil || mediaType != "multipart/alternative" {
		t.Fatalf("Content-Type = %q (%v), want multipart/alternative", mediaType, err)
	}

	parts := map[string]string{}
	reader := multipart.NewReader(parsed.Body, params["boundary"])
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("failed to read a part: %v", err)
		}
		decoded, err := io.ReadAll(base64.NewDecoder(base64.StdEncoding, part))
		if err != nil {
			t.Fatalf("part %s is not valid base64: %v", part.Header.Get("Content-Type"), err)
		}
		parts[part.Header.Get("Content-Type")] = string(decoded)
	}

	if !strings.Contains(parts["text/plain; charset=UTF-8"], "123456") {
		t.Errorf("the text part lost the code: %q", parts["text/plain; charset=UTF-8"])
	}
	if !strings.Contains(parts["text/html; charset=UTF-8"], "123456") {
		t.Errorf("the html part lost the code: %q", parts["text/html; charset=UTF-8"])
	}
	if !strings.HasPrefix(parsed.Header.Get("Subject"), "=?UTF-8?B?") {
		t.Errorf("the bilingual subject was not RFC 2047 encoded: %q", parsed.Header.Get("Subject"))
	}
}

// A raw UTF-8 header is not valid, and a pure-ASCII one should be left alone rather than
// wrapped in an encoded word nobody needed.
func TestEncodeHeader(t *testing.T) {
	if got := encodeHeader("plain ascii"); got != "plain ascii" {
		t.Errorf("encodeHeader(ascii) = %q", got)
	}
	got := encodeHeader("验证码")
	if !strings.HasPrefix(got, "=?UTF-8?B?") || !strings.HasSuffix(got, "?=") {
		t.Errorf("encodeHeader(chinese) = %q, want an RFC 2047 encoded word", got)
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSuffix(strings.TrimPrefix(got, "=?UTF-8?B?"), "?="))
	if err != nil || string(decoded) != "验证码" {
		t.Errorf("the encoded word does not decode back: %q (%v)", decoded, err)
	}
	if got := encodeHeader("a\r\nBcc: x"); strings.Contains(got, "\r") {
		t.Errorf("encodeHeader kept a CR: %q", got)
	}
}

// A relay that offers STARTTLS and then cannot complete it must fail the send. Continuing
// would put the code — and, with a username set, the credentials — on the wire.
func TestSMTPMailerFailsWhenTLSIsBroken(t *testing.T) {
	host, port, _ := fakeRelay(t, true)
	m := NewSMTPMailer(host, port, "", "", "no-reply@ohyourear.test")

	err := m.Send(context.Background(), "reader@example.com", "code", "123456", "<p>123456</p>")
	if err == nil {
		t.Fatal("the send succeeded although the relay could not speak TLS")
	}
	if !strings.Contains(err.Error(), "tls") {
		t.Errorf("error = %v, want one about TLS", err)
	}
}

func TestIsPrivateRelay(t *testing.T) {
	cases := []struct {
		host string
		want bool
	}{
		{"127.0.0.1", true},
		{"::1", true},
		{"10.1.2.3", true},
		{"172.16.0.9", true},
		{"192.168.1.20", true},
		// What podman's host.containers.internal resolves to; a relay reached that way is on
		// the segment the host sits on.
		{"169.254.1.2", true},
		{"8.8.8.8", false},
		{"1.1.1.1", false},
	}

	for _, c := range cases {
		m := &SMTPMailer{host: c.host}
		if got := m.isPrivateRelay(); got != c.want {
			t.Errorf("isPrivateRelay(%q) = %t, want %t", c.host, got, c.want)
		}
	}
}

// `to` is an address a caller supplied, so a bare CRLF in it would start headers of the
// caller's choosing.
func TestMessageDropsHeaderInjection(t *testing.T) {
	m := &SMTPMailer{from: "no-reply@ohyourear.test"}
	message := m.message("victim@example.com\r\nBcc: attacker@example.com", "code", "123456", "<p>1</p>")

	if strings.Contains(message, "\r\nBcc:") {
		t.Errorf("the injected header survived:\n%s", message)
	}
	if !strings.Contains(message, "Bcc: attacker") {
		t.Error("the address was mangled rather than neutralised")
	}
}

// Note: the implicit-TLS path (port 465) has no unit test. It keys on the port number, and
// a test relay cannot bind 465 without root, so it is verified against the real relay this
// app actually uses instead — which is how the first version of it was caught requiring
// STARTTLS on a connection that was already encrypted.
