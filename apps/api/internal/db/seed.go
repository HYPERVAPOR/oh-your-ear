package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// levelSeed is one official level: a parameter set plus the round it runs.
// These were a hardcoded array in the web client until levels became data.
type levelSeed struct {
	slug      string
	titleZh   string
	titleEn   string
	questions int
	passMark  float64
	config    string
}

type setSeed struct {
	slug     string
	module   string
	titleZh  string
	titleEn  string
	descZh   string
	descEn   string
	position int
	levels   []levelSeed
}

const passMark = 0.8

// officialLevels is the seeded catalog, easy to hard per module. Editing this and
// restarting the API updates the catalog in place: the upsert keeps slugs stable,
// which is what progress and, later, collections hang off.
var officialLevels = []setSeed{
	{
		slug: "single-note-basics", module: "singleNote", position: 1,
		titleZh: "单音基础", titleEn: "Single note",
		descZh: "从一个八度内的白键开始，逐步加入黑键与更宽的音域。",
		descEn: "Start with white keys inside one octave, then add accidentals and a wider range.",
		levels: []levelSeed{
			{"singleNote-1", "白键起步", "White keys, one octave", 5, passMark, `{"whiteKeys":true,"blackKeys":false,"range":"narrow"}`},
			{"singleNote-2", "整个八度", "The whole octave", 10, passMark, `{"whiteKeys":true,"blackKeys":false,"range":"medium"}`},
			{"singleNote-3", "加入黑键", "Add the black keys", 10, passMark, `{"whiteKeys":true,"blackKeys":true,"range":"medium"}`},
			{"singleNote-4", "更宽音域", "Wider range", 10, passMark, `{"whiteKeys":true,"blackKeys":true,"range":"wide"}`},
		},
	},
	{
		slug: "intervals", module: "interval", position: 2,
		titleZh: "音程", titleEn: "Intervals",
		descZh: "先分辨大小二度三度，再扩展到四度五度与全部音程。",
		descEn: "Tell seconds and thirds apart first, then widen to fourths, fifths and everything.",
		levels: []levelSeed{
			{"interval-1", "二三度", "Seconds and thirds", 5, passMark, `{"intervals":["2m","2M","3m","3M"]}`},
			{"interval-2", "加入四五度", "Add fourths and fifths", 8, passMark, `{"intervals":["2m","2M","3m","3M","4P","5P"]}`},
			{"interval-3", "加入八度", "Add the octave", 10, passMark, `{"intervals":["1P","2m","2M","3m","3M","4P","5P","8P"]}`},
			{"interval-4", "全部音程", "Every interval", 10, passMark, `{"intervals":["1P","2m","2M","3m","3M","4P","5P","6m","6M","7m","7M","8P"]}`},
		},
	},
	{
		slug: "chords", module: "chord", position: 3,
		titleZh: "和弦", titleEn: "Chords",
		descZh: "从大小三和弦到增三和弦，再到各种七和弦。",
		descEn: "Major and minor triads first, then augmented and diminished, then the sevenths.",
		levels: []levelSeed{
			{"chord-1", "大小三和弦", "Major and minor", 5, passMark, `{"types":["major","minor"]}`},
			{"chord-2", "四种三和弦", "All four triads", 8, passMark, `{"types":["major","minor","diminished","augmented"]}`},
			{"chord-3", "加入七和弦", "Add seventh chords", 10, passMark, `{"types":["major","minor","diminished","augmented","maj7","min7"]}`},
			{"chord-4", "全部和弦", "Every chord", 10, passMark, `{"types":["major","minor","diminished","augmented","maj7","min7","7"]}`},
		},
	},
	{
		slug: "melody", module: "melody", position: 4,
		titleZh: "旋律", titleEn: "Melody",
		descZh: "三个音起步、放慢速度，逐步加长加快并扩到黑键。",
		descEn: "Three notes at a slow tempo, lengthening and speeding up, then accidentals.",
		levels: []levelSeed{
			{"melody-1", "三个音", "Three notes", 5, passMark, `{"length":3,"speed":"slow","whiteKeys":true,"blackKeys":false,"range":"narrow"}`},
			{"melody-2", "四个音", "Four notes", 8, passMark, `{"length":4,"speed":"normal","whiteKeys":true,"blackKeys":false,"range":"medium"}`},
			{"melody-3", "五个音带黑键", "Five notes, accidentals", 10, passMark, `{"length":5,"speed":"normal","whiteKeys":true,"blackKeys":true,"range":"medium"}`},
			{"melody-4", "六个音加快", "Six notes, faster", 10, passMark, `{"length":6,"speed":"fast","whiteKeys":true,"blackKeys":true,"range":"wide"}`},
		},
	},
	{
		slug: "rhythm", module: "rhythm", position: 5,
		titleZh: "节奏", titleEn: "Rhythm",
		descZh: "先敲四分音符，再加入八分音符并逐步加长节奏型。",
		descEn: "Quarter notes first, then eighths, with longer patterns as you go.",
		levels: []levelSeed{
			{"rhythm-1", "四分音符", "Quarter notes", 5, passMark, `{"patternLength":3,"durations":[1]}`},
			{"rhythm-2", "加入八分音符", "Add eighths", 8, passMark, `{"patternLength":4,"durations":[1,0.5]}`},
			{"rhythm-3", "更长节奏型", "Longer patterns", 10, passMark, `{"patternLength":6,"durations":[1,0.5]}`},
			{"rhythm-4", "八拍", "Eight beats", 10, passMark, `{"patternLength":8,"durations":[1,0.5]}`},
		},
	},
}

// SeedLevels writes the official catalog. It is idempotent and only touches
// official sets: a user's own sets and levels are left alone.
func SeedLevels(ctx context.Context, pool *pgxpool.Pool) error {
	for _, set := range officialLevels {
		var setID string
		err := pool.QueryRow(ctx, `
			INSERT INTO level_sets (slug, module, title_zh, title_en, description_zh, description_en, is_official, position)
			VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
			ON CONFLICT (slug) DO UPDATE SET
				module = EXCLUDED.module,
				title_zh = EXCLUDED.title_zh,
				title_en = EXCLUDED.title_en,
				description_zh = EXCLUDED.description_zh,
				description_en = EXCLUDED.description_en,
				position = EXCLUDED.position
			RETURNING id
		`, set.slug, set.module, set.titleZh, set.titleEn, set.descZh, set.descEn, set.position).Scan(&setID)
		if err != nil {
			return fmt.Errorf("failed to seed level set %s: %w", set.slug, err)
		}

		for index, level := range set.levels {
			_, err := pool.Exec(ctx, `
				INSERT INTO levels (set_id, slug, position, title_zh, title_en, questions, pass_mark, config)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
				ON CONFLICT (slug) DO UPDATE SET
					set_id = EXCLUDED.set_id,
					position = EXCLUDED.position,
					title_zh = EXCLUDED.title_zh,
					title_en = EXCLUDED.title_en,
					questions = EXCLUDED.questions,
					pass_mark = EXCLUDED.pass_mark,
					config = EXCLUDED.config
			`, setID, level.slug, index+1, level.titleZh, level.titleEn, level.questions, level.passMark, level.config)
			if err != nil {
				return fmt.Errorf("failed to seed level %s: %w", level.slug, err)
			}
		}
	}

	return nil
}
