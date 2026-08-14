package com.ewha_eng.grmr.global.exception;

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
}
