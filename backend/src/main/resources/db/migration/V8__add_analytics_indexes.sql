CREATE INDEX idx_study_record_member_id_submitted_at ON study_record (member_id, submitted_at);
CREATE INDEX idx_study_record_type_submitted_at ON study_record (type, submitted_at);
CREATE INDEX idx_study_record_category ON study_record (category);

CREATE INDEX idx_member_type_student_group ON member (type, student_group);

CREATE INDEX idx_assignment_submission_student_id_status ON assignment_submission (student_id, status);
CREATE INDEX idx_assignment_submission_assignment_id_status ON assignment_submission (assignment_id, status);
