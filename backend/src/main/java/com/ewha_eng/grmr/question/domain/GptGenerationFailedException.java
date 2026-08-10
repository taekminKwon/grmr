package com.ewha_eng.grmr.question.domain;

public class GptGenerationFailedException extends RuntimeException {

    public GptGenerationFailedException(String message) {
        super(message);
    }
}
