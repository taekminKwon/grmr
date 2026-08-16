CREATE TABLE assignment (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_group VARCHAR(100),
    target_student_id BIGINT REFERENCES member(id),
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_assignment_target_group ON assignment (target_group);
CREATE INDEX idx_assignment_target_student_id ON assignment (target_student_id);

CREATE TABLE assignment_question (
    assignment_id BIGINT NOT NULL REFERENCES assignment(id),
    question_order INT NOT NULL,
    question_id BIGINT NOT NULL REFERENCES question(id),
    PRIMARY KEY (assignment_id, question_order),
    CONSTRAINT uk_assignment_question_question UNIQUE (assignment_id, question_id)
);
