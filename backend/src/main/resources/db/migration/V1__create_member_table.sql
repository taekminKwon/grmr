CREATE TABLE member (
    id BIGSERIAL PRIMARY KEY,
    login_id VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    CONSTRAINT uk_member_login_id UNIQUE (login_id)
);
