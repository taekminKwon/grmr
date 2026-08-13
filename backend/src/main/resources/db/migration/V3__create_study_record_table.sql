CREATE TABLE study_record (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES member(id),
    question_id BIGINT NOT NULL REFERENCES question(id),
    type VARCHAR(20) NOT NULL,
    category VARCHAR(100) NOT NULL,
    level VARCHAR(20) NOT NULL,
    text TEXT NOT NULL,
    correct_answer VARCHAR(255) NOT NULL,
    explanation TEXT NOT NULL,
    submitted_answer VARCHAR(255) NOT NULL,
    correct BOOLEAN NOT NULL,
    submitted_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_study_record_member_id ON study_record (member_id);

CREATE TABLE study_record_choice (
    study_record_id BIGINT NOT NULL REFERENCES study_record(id),
    choice_order INT NOT NULL,
    choice VARCHAR(255) NOT NULL,
    PRIMARY KEY (study_record_id, choice_order)
);
