package api

import (
	"fmt"
	"html"
)

// verificationEmail renders the code mail.
//
// Three rules for the template, all of them about the fact that an email client is not a
// browser:
//
//   - No external resource: no image, no stylesheet, no font. Clients strip them, and a
//     verification mail that arrives as a broken box is worse than a plain one.
//   - Every style is inline. A <style> block survives in some clients and not others, and
//     "some" is how a mail looks right on the machine it was tested on and wrong everywhere
//     else.
//   - The code is the largest thing in the message, monospace, alone on a hairline panel.
//     The reader came for six digits, not to read.
//
// The dark palette lives in a media query, which is why it needs `!important`: inline
// styles win that fight otherwise. Clients that ignore the query get the light one, so the
// light one is what the markup spells out.
func verificationEmail(code string, minutes int) (subject, text, body string) {
	subject = "Oh Your Ear 验证码 / verification code"

	text = fmt.Sprintf(
		"你的验证码 / Your code:\n\n    %s\n\n"+
			"%%d 分钟内有效 / Expires in %%d minutes\n\n"+
			"不是你本人操作就忽略这封邮件。\nIf this was not you, ignore this mail.\n\n"+
			"https://app.ohyourear.com\n",
		code,
	)
	text = fmt.Sprintf(text, minutes, minutes)

	// Monospace, with a fallback chain: the mail cannot load our font, and a proportional
	// font makes six digits harder to read back accurately.
	const mono = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace"
	const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif"

	body = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>` + html.EscapeString(subject) + `</title>
<style>
  @media (prefers-color-scheme: dark) {
    .oye-canvas { background: #12100f !important; }
    .oye-card { background: #1c1917 !important; border-color: #554b45 !important; }
    .oye-rule { border-color: #3b332e !important; }
    .oye-ink { color: #f5f5f4 !important; }
    .oye-body { color: #d6d3d1 !important; }
    .oye-muted { color: #a8a29e !important; }
    .oye-code { background: #0c0a09 !important; border-color: #554b45 !important; color: #f5f5f4 !important; }
  }
</style>
</head>
<body class="oye-canvas" style="margin:0;padding:24px;background:#f4f2ef;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="440"
               class="oye-card"
               style="width:440px;max-width:100%;background:#ffffff;border:1px solid #aea9a4;">
          <tr>
            <td class="oye-ink"
                style="padding:18px 24px;border-bottom:1px solid #c5bfbb;font:600 12px/1 ` + mono + `;letter-spacing:.14em;text-transform:uppercase;color:#0c0a09;">
              Oh Your Ear
            </td>
          </tr>
          <tr>
            <td class="oye-body" style="padding:26px 24px 0;font:15px/1.5 ` + sans + `;color:#44403c;">
              你的验证码 / Your code
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px 0;">
              <div class="oye-code"
                   style="background:#faf9f7;border:1px solid #c5bfbb;padding:20px 0;text-align:center;font:32px/1 ` + mono + `;letter-spacing:.3em;color:#0c0a09;text-indent:.3em;">
                ` + html.EscapeString(code) + `
              </div>
            </td>
          </tr>
          <tr>
            <td class="oye-muted" style="padding:14px 24px 26px;font:14px/1.5 ` + sans + `;color:#78716c;">
              ` + fmt.Sprint(minutes) + ` 分钟内有效 / Expires in ` + fmt.Sprint(minutes) + ` minutes
            </td>
          </tr>
          <tr>
            <td class="oye-muted oye-rule"
                style="padding:16px 24px;border-top:1px solid #c5bfbb;font:13px/1.7 ` + sans + `;color:#78716c;">
              不是你本人操作的话，忽略这封邮件就行。<br />
              If this was not you, ignore this mail.
            </td>
          </tr>
        </table>
        <p class="oye-muted" style="margin:16px 0 0;font:13px/1.5 ` + mono + `;color:#78716c;">
          <a href="https://app.ohyourear.com" class="oye-muted" style="color:#78716c;text-decoration:underline;">app.ohyourear.com</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`

	return subject, text, body
}
