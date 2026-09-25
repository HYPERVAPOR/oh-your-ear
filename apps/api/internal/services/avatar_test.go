package services

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"
)

func pngOf(t *testing.T, width, height int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	img.Set(0, 0, color.RGBA{R: 1, G: 2, B: 3, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode: %v", err)
	}
	return buf.Bytes()
}

func TestValidateAvatar(t *testing.T) {
	cases := []struct {
		name string
		data []byte
		want string
		err  error
	}{
		{"a 256x256 png", pngOf(t, 256, 256), "image/png", nil},
		{"a 16x16 png, the smallest that counts", pngOf(t, 16, 16), "image/png", nil},
		{"a 15x15 png", pngOf(t, 15, 15), "", ErrAvatarUnreadable},
		{"a 1024x1024 png", pngOf(t, 1024, 1024), "image/png", nil},
		{"a 1025x1025 png", pngOf(t, 1025, 1025), "", ErrAvatarUnreadable},
		{"something that is not an image at all", []byte("not a picture"), "", ErrAvatarUnreadable},
		{"an empty upload", nil, "", ErrAvatarTooBig},
		{"one byte over the ceiling", make([]byte, MaxAvatarBytes+1), "", ErrAvatarTooBig},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			mime, err := validateAvatar(tc.data)
			if err != tc.err {
				t.Fatalf("err = %v, want %v", err, tc.err)
			}
			if mime != tc.want {
				t.Fatalf("mime = %q, want %q", mime, tc.want)
			}
		})
	}
}
