package services

import (
	"testing"
	"time"
)

func TestStreakFrom(t *testing.T) {
	tz, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		t.Fatalf("failed to load timezone: %v", err)
	}
	now := time.Date(2026, 9, 18, 21, 30, 0, 0, tz)
	day := func(offset int, hour int) time.Time {
		return time.Date(2026, 9, 18+offset, hour, 0, 0, 0, tz)
	}

	cases := []struct {
		name string
		days []time.Time
		want int
	}{
		{"no practice", nil, 0},
		{"today only", []time.Time{day(0, 9)}, 1},
		{"today and yesterday", []time.Time{day(0, 9), day(-1, 23)}, 2},
		{"three in a row", []time.Time{day(0, 9), day(-1, 9), day(-2, 9)}, 3},
		{"gap breaks the streak", []time.Time{day(0, 9), day(-2, 9), day(-3, 9)}, 1},
		{"today not practised yet, yesterday counts", []time.Time{day(-1, 9), day(-2, 9)}, 2},
		{"last practice two days ago is broken", []time.Time{day(-2, 9), day(-3, 9)}, 0},
		{"several answers in one day count once", []time.Time{day(0, 20), day(0, 9), day(-1, 9)}, 2},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := streakFrom(tc.days, now); got != tc.want {
				t.Fatalf("streakFrom() = %d, want %d", got, tc.want)
			}
		})
	}
}
