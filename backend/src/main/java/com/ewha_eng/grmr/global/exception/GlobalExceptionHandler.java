package com.ewha_eng.grmr.global.exception;

import com.ewha_eng.grmr.assignment.domain.AssignmentAlreadyClosedException;
import com.ewha_eng.grmr.assignment.domain.AssignmentNotFoundException;
import com.ewha_eng.grmr.assignment.domain.InvalidAssignmentException;
import com.ewha_eng.grmr.assignment.domain.InvalidAssignmentSearchException;
import com.ewha_eng.grmr.assignment.domain.StudentNotFoundException;
import com.ewha_eng.grmr.auth.domain.InvalidCredentialsException;
import com.ewha_eng.grmr.auth.domain.InvalidRefreshTokenException;
import com.ewha_eng.grmr.member.domain.MemberNotFoundException;
import com.ewha_eng.grmr.question.domain.GptGenerationFailedException;
import com.ewha_eng.grmr.question.domain.InvalidQuestionException;
import com.ewha_eng.grmr.question.domain.InvalidStatusTransitionException;
import com.ewha_eng.grmr.question.domain.NoQuestionAvailableException;
import com.ewha_eng.grmr.question.domain.QuestionNotFoundException;
import com.ewha_eng.grmr.question.domain.QuestionNotInUseException;
import com.ewha_eng.grmr.question.domain.QuestionTypeNotSupportedException;
import com.ewha_eng.grmr.student.domain.InvalidStudentSearchException;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentAlreadySubmittedException;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentClosedException;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentNotSubmittedException;
import com.ewha_eng.grmr.studentassignment.domain.InvalidAssignmentSubmissionException;
import com.ewha_eng.grmr.studentassignment.domain.QuestionNotInAssignmentException;
import com.ewha_eng.grmr.studyrecord.domain.InvalidStudyRecordException;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleHttpMessageNotReadable(HttpMessageNotReadableException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse("INVALID_REQUEST", "요청 본문 형식이 올바르지 않습니다."));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentTypeMismatch(MethodArgumentTypeMismatchException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse("INVALID_REQUEST", "요청 파라미터 형식이 올바르지 않습니다: " + e.getName()));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCredentials(InvalidCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(new ErrorResponse("INVALID_CREDENTIALS", e.getMessage()));
    }

    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ResponseEntity<ErrorResponse> handleInvalidRefreshToken(InvalidRefreshTokenException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(new ErrorResponse("INVALID_REFRESH_TOKEN", e.getMessage()));
    }

    @ExceptionHandler(InvalidQuestionException.class)
    public ResponseEntity<ErrorResponse> handleInvalidQuestion(InvalidQuestionException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse("INVALID_QUESTION", e.getMessage()));
    }

    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ErrorResponse> handleInvalidRequest(InvalidRequestException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse("INVALID_REQUEST", e.getMessage()));
    }

    @ExceptionHandler(QuestionNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleQuestionNotFound(QuestionNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("QUESTION_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(InvalidStatusTransitionException.class)
    public ResponseEntity<ErrorResponse> handleInvalidStatusTransition(InvalidStatusTransitionException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse("INVALID_STATUS_TRANSITION", e.getMessage()));
    }

    @ExceptionHandler(GptGenerationFailedException.class)
    public ResponseEntity<ErrorResponse> handleGptGenerationFailed(GptGenerationFailedException e) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .body(new ErrorResponse("GPT_GENERATION_FAILED", e.getMessage()));
    }

    @ExceptionHandler(NoQuestionAvailableException.class)
    public ResponseEntity<ErrorResponse> handleNoQuestionAvailable(NoQuestionAvailableException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("NO_QUESTION_AVAILABLE", e.getMessage()));
    }

    @ExceptionHandler(QuestionNotInUseException.class)
    public ResponseEntity<ErrorResponse> handleQuestionNotInUse(QuestionNotInUseException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse("QUESTION_NOT_IN_USE", e.getMessage()));
    }

    @ExceptionHandler(QuestionTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleQuestionTypeNotSupported(QuestionTypeNotSupportedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse("QUESTION_TYPE_NOT_SUPPORTED", e.getMessage()));
    }

    @ExceptionHandler(MemberNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleMemberNotFound(MemberNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("MEMBER_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(StudyRecordNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleStudyRecordNotFound(StudyRecordNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("STUDY_RECORD_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(InvalidStudyRecordException.class)
    public ResponseEntity<ErrorResponse> handleInvalidStudyRecord(InvalidStudyRecordException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse("INVALID_REQUEST", e.getMessage()));
    }

    @ExceptionHandler(AssignmentNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleAssignmentNotFound(AssignmentNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("ASSIGNMENT_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(InvalidAssignmentSearchException.class)
    public ResponseEntity<ErrorResponse> handleInvalidAssignmentSearch(InvalidAssignmentSearchException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse("INVALID_REQUEST", e.getMessage()));
    }

    @ExceptionHandler(InvalidAssignmentException.class)
    public ResponseEntity<ErrorResponse> handleInvalidAssignment(InvalidAssignmentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse("INVALID_ASSIGNMENT", e.getMessage()));
    }

    @ExceptionHandler(AssignmentAlreadyClosedException.class)
    public ResponseEntity<ErrorResponse> handleAssignmentAlreadyClosed(AssignmentAlreadyClosedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse("ASSIGNMENT_ALREADY_CLOSED", e.getMessage()));
    }

    @ExceptionHandler(StudentNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleStudentNotFound(StudentNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("STUDENT_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(QuestionNotInAssignmentException.class)
    public ResponseEntity<ErrorResponse> handleQuestionNotInAssignment(QuestionNotInAssignmentException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("QUESTION_NOT_IN_ASSIGNMENT", e.getMessage()));
    }

    @ExceptionHandler(AssignmentClosedException.class)
    public ResponseEntity<ErrorResponse> handleAssignmentClosed(AssignmentClosedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse("ASSIGNMENT_CLOSED", e.getMessage()));
    }

    @ExceptionHandler(AssignmentAlreadySubmittedException.class)
    public ResponseEntity<ErrorResponse> handleAssignmentAlreadySubmitted(AssignmentAlreadySubmittedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse("ASSIGNMENT_ALREADY_SUBMITTED", e.getMessage()));
    }

    @ExceptionHandler(InvalidAssignmentSubmissionException.class)
    public ResponseEntity<ErrorResponse> handleInvalidAssignmentSubmission(InvalidAssignmentSubmissionException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse("INVALID_REQUEST", e.getMessage()));
    }

    @ExceptionHandler(AssignmentNotSubmittedException.class)
    public ResponseEntity<ErrorResponse> handleAssignmentNotSubmitted(AssignmentNotSubmittedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse("ASSIGNMENT_NOT_SUBMITTED", e.getMessage()));
    }

    @ExceptionHandler(InvalidStudentSearchException.class)
    public ResponseEntity<ErrorResponse> handleInvalidStudentSearch(InvalidStudentSearchException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse("INVALID_REQUEST", e.getMessage()));
    }
}
