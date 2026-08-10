CREATE TABLE question (
    id BIGSERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    level VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    text TEXT NOT NULL,
    answer VARCHAR(255) NOT NULL,
    explanation TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE question_choice (
    question_id BIGINT NOT NULL REFERENCES question(id),
    choice_order INT NOT NULL,
    choice VARCHAR(255) NOT NULL,
    PRIMARY KEY (question_id, choice_order)
);
