ALTER TABLE study_record ALTER COLUMN submitted_answer DROP NOT NULL;

ALTER TABLE study_record ADD COLUMN assignment_id BIGINT REFERENCES assignment(id);

CREATE INDEX idx_study_record_assignment_id ON study_record (assignment_id);
