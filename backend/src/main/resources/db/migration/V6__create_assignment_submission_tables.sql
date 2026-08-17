CREATE TABLE assignment_submission (
    id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES assignment(id),
    student_id BIGINT NOT NULL REFERENCES member(id),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    submitted_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_assignment_submission_assignment_student UNIQUE (assignment_id, student_id)
);

CREATE INDEX idx_assignment_submission_assignment_id ON assignment_submission (assignment_id);
CREATE INDEX idx_assignment_submission_student_id ON assignment_submission (student_id);

CREATE TABLE assignment_answer_draft (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES assignment_submission(id),
    question_id BIGINT NOT NULL REFERENCES question(id),
    answer VARCHAR(255) NOT NULL,
    saved_at TIMESTAMP NOT NULL,
    CONSTRAINT uk_assignment_answer_draft_submission_question UNIQUE (submission_id, question_id)
);

CREATE INDEX idx_assignment_answer_draft_submission_id ON assignment_answer_draft (submission_id);
