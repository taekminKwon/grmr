package com.ewha_eng.grmr.studentassignment.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class AssignmentSubmissionTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 8, 15, 10, 0);

    @Test
    void start_createsInProgressSubmission_withCreatedAt() {
        AssignmentSubmission submission = AssignmentSubmission.start(1L, 501L, NOW);

        assertThat(submission.getAssignmentId()).isEqualTo(1L);
        assertThat(submission.getStudentId()).isEqualTo(501L);
        assertThat(submission.getStatus()).isEqualTo(SubmissionStatus.IN_PROGRESS);
        assertThat(submission.getCreatedAt()).isEqualTo(NOW);
        assertThat(submission.getSubmittedAt()).isNull();
        assertThat(submission.isSubmitted()).isFalse();
        assertThat(submission.answeredQuestionCount()).isZero();
    }

    @Test
    void start_throws_whenAssignmentIdIsNull() {
        assertThatThrownBy(() -> AssignmentSubmission.start(null, 501L, NOW))
            .isInstanceOf(InvalidAssignmentSubmissionException.class);
    }

    @Test
    void start_throws_whenStudentIdIsNull() {
        assertThatThrownBy(() -> AssignmentSubmission.start(1L, null, NOW))
            .isInstanceOf(InvalidAssignmentSubmissionException.class);
    }

    @Test
    void upsertDraft_addsNewDraft_whenQuestionNotYetAnswered() {
        AssignmentSubmission submission = AssignmentSubmission.start(1L, 501L, NOW);

        submission.upsertDraft(1024L, "since", NOW);

        assertThat(submission.answeredQuestionCount()).isEqualTo(1);
        assertThat(submission.answerFor(1024L)).contains("since");
    }

    @Test
    void upsertDraft_overwritesExistingAnswer_withoutCreatingSecondRecord() {
        AssignmentSubmission submission = AssignmentSubmission.start(1L, 501L, NOW);
        submission.upsertDraft(1024L, "since", NOW);

        submission.upsertDraft(1024L, "for", NOW.plusMinutes(1));

        assertThat(submission.answeredQuestionCount()).isEqualTo(1);
        assertThat(submission.answerFor(1024L)).contains("for");
    }

    @Test
    void upsertDraft_tracksMultipleQuestionsIndependently() {
        AssignmentSubmission submission = AssignmentSubmission.start(1L, 501L, NOW);

        submission.upsertDraft(1024L, "since", NOW);
        submission.upsertDraft(1023L, "for", NOW);

        assertThat(submission.answeredQuestionCount()).isEqualTo(2);
        assertThat(submission.answerFor(1024L)).contains("since");
        assertThat(submission.answerFor(1023L)).contains("for");
    }

    @Test
    void answerFor_returnsEmpty_whenQuestionNeverSaved() {
        AssignmentSubmission submission = AssignmentSubmission.start(1L, 501L, NOW);

        assertThat(submission.answerFor(9999L)).isEmpty();
    }

    @Test
    void upsertDraft_throws_whenQuestionIdIsNull() {
        AssignmentSubmission submission = AssignmentSubmission.start(1L, 501L, NOW);

        assertThatThrownBy(() -> submission.upsertDraft(null, "since", NOW))
            .isInstanceOf(InvalidAssignmentSubmissionException.class);
    }

    @Test
    void upsertDraft_throws_whenAnswerIsBlank() {
        AssignmentSubmission submission = AssignmentSubmission.start(1L, 501L, NOW);

        assertThatThrownBy(() -> submission.upsertDraft(1024L, "   ", NOW))
            .isInstanceOf(InvalidAssignmentSubmissionException.class);
    }

    @Test
    void upsertDraft_throws_afterSubmission() {
        AssignmentSubmission submission = AssignmentSubmission.start(1L, 501L, NOW);
        submission.submit(NOW);

        assertThatThrownBy(() -> submission.upsertDraft(1024L, "since", NOW))
            .isInstanceOf(AssignmentAlreadySubmittedException.class);
    }

    @Test
    void submit_transitionsToSubmitted_andRecordsSubmittedAt() {
        AssignmentSubmission submission = AssignmentSubmission.start(1L, 501L, NOW);
        submission.upsertDraft(1024L, "since", NOW);

        submission.submit(NOW.plusHours(1));

        assertThat(submission.isSubmitted()).isTrue();
        assertThat(submission.getStatus()).isEqualTo(SubmissionStatus.SUBMITTED);
        assertThat(submission.getSubmittedAt()).isEqualTo(NOW.plusHours(1));
    }

    @Test
    void submit_throws_whenAlreadySubmitted() {
        AssignmentSubmission submission = AssignmentSubmission.start(1L, 501L, NOW);
        submission.submit(NOW);

        assertThatThrownBy(() -> submission.submit(NOW.plusMinutes(1)))
            .isInstanceOf(AssignmentAlreadySubmittedException.class);
    }
}
