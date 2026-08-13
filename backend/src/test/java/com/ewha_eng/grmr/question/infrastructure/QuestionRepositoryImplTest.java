package com.ewha_eng.grmr.question.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionStatus;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class QuestionRepositoryImplTest {

    @Autowired
    private QuestionRepository questionRepository;

    @Test
    void 카테고리_유형_난이도_상태_키워드를_모두_만족하는_문제만_조회한다() {
        save("현재완료", QuestionType.MULTIPLE_CHOICE, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "사과를 고르는 문제", LocalDateTime.now().minusDays(1));
        save("현재완료", QuestionType.FILL_IN_BLANK, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "사과를 고르는 다른 문제", LocalDateTime.now());
        save("관계대명사", QuestionType.MULTIPLE_CHOICE, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "사과를 고르는 문제", LocalDateTime.now());
        save("현재완료", QuestionType.MULTIPLE_CHOICE, QuestionLevel.ADVANCED, QuestionStatus.ACTIVE,
            "사과를 고르는 문제", LocalDateTime.now());
        save("현재완료", QuestionType.MULTIPLE_CHOICE, QuestionLevel.BASIC, QuestionStatus.DRAFT,
            "사과를 고르는 문제", LocalDateTime.now());
        save("현재완료", QuestionType.MULTIPLE_CHOICE, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "바나나를 고르는 문제", LocalDateTime.now());

        Page<Question> result = questionRepository.search("현재완료", QuestionType.MULTIPLE_CHOICE,
            QuestionLevel.BASIC, QuestionStatus.ACTIVE, "사과", PageRequest.of(0, 10));

        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getCategory()).isEqualTo("현재완료");
        assertThat(result.getContent().get(0).getType()).isEqualTo(QuestionType.MULTIPLE_CHOICE);
        assertThat(result.getContent().get(0).getLevel()).isEqualTo(QuestionLevel.BASIC);
        assertThat(result.getContent().get(0).getStatus()).isEqualTo(QuestionStatus.ACTIVE);
    }

    @Test
    void 필터가_없으면_전체_문제를_조회한다() {
        save("현재완료", QuestionType.MULTIPLE_CHOICE, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "첫 번째 문제", LocalDateTime.now());
        save("관계대명사", QuestionType.FILL_IN_BLANK, QuestionLevel.ADVANCED, QuestionStatus.DRAFT,
            "두 번째 문제", LocalDateTime.now());

        Page<Question> result = questionRepository.search(null, null, null, null, null, PageRequest.of(0, 10));

        assertThat(result.getTotalElements()).isEqualTo(2);
    }

    @Test
    void 키워드의_퍼센트는_와일드카드가_아닌_리터럴로_취급한다() {
        save("현재완료", QuestionType.FILL_IN_BLANK, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "정답률 100%할인 이벤트", LocalDateTime.now());
        save("현재완료", QuestionType.FILL_IN_BLANK, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "정답률 100원 할인 이벤트", LocalDateTime.now());

        Page<Question> result = questionRepository.search(null, null, null, null, "100%", PageRequest.of(0, 10));

        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent().get(0).getText()).contains("100%할인");
    }

    @Test
    void 키워드의_언더바는_와일드카드가_아닌_리터럴로_취급한다() {
        save("현재완료", QuestionType.FILL_IN_BLANK, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "코드 a_b 를 입력하세요", LocalDateTime.now());
        save("현재완료", QuestionType.FILL_IN_BLANK, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "코드 aXb 를 입력하세요", LocalDateTime.now());

        Page<Question> result = questionRepository.search(null, null, null, null, "a_b", PageRequest.of(0, 10));

        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent().get(0).getText()).contains("a_b");
    }

    @Test
    void createdAt_내림차순으로_정렬하고_생성일이_같으면_id_내림차순으로_정렬한다() {
        LocalDateTime sameInstant = LocalDateTime.now();
        Question older = save("현재완료", QuestionType.FILL_IN_BLANK, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "가장 오래된 문제", sameInstant.minusDays(1));
        Question tieFirst = save("현재완료", QuestionType.FILL_IN_BLANK, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "동시각 첫번째 문제", sameInstant);
        Question tieSecond = save("현재완료", QuestionType.FILL_IN_BLANK, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "동시각 두번째 문제", sameInstant);
        Question newest = save("현재완료", QuestionType.FILL_IN_BLANK, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "가장 최근 문제", sameInstant.plusDays(1));

        Page<Question> result = questionRepository.search(null, null, null, null, null, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Question::getId)
            .containsExactly(newest.getId(), tieSecond.getId(), tieFirst.getId(), older.getId());
    }

    @Test
    void 페이지_크기와_총_개수를_경계값까지_정확히_반환한다() {
        for (int i = 0; i < 5; i++) {
            save("현재완료", QuestionType.FILL_IN_BLANK, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
                "문제 " + i, LocalDateTime.now().plusSeconds(i));
        }

        Page<Question> firstPage = questionRepository.search(null, null, null, null, null, PageRequest.of(0, 2));
        Page<Question> lastPage = questionRepository.search(null, null, null, null, null, PageRequest.of(2, 2));

        assertThat(firstPage.getContent()).hasSize(2);
        assertThat(firstPage.getTotalElements()).isEqualTo(5);
        assertThat(firstPage.getTotalPages()).isEqualTo(3);

        assertThat(lastPage.getContent()).hasSize(1);
        assertThat(lastPage.getTotalElements()).isEqualTo(5);
        assertThat(lastPage.isLast()).isTrue();
    }

    @Test
    void findActiveMultipleChoice_returnsOnlyActiveMultipleChoiceQuestions() {
        Question activeMultipleChoice = save("현재완료", QuestionType.MULTIPLE_CHOICE, QuestionLevel.BASIC,
            QuestionStatus.ACTIVE, "정답을 고르는 문제", LocalDateTime.now());
        save("현재완료", QuestionType.FILL_IN_BLANK, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "빈칸 문제", LocalDateTime.now());
        save("현재완료", QuestionType.MULTIPLE_CHOICE, QuestionLevel.BASIC, QuestionStatus.DRAFT,
            "초안 문제", LocalDateTime.now());
        save("현재완료", QuestionType.MULTIPLE_CHOICE, QuestionLevel.BASIC, QuestionStatus.INACTIVE,
            "사용 중지 문제", LocalDateTime.now());

        List<Question> result = questionRepository.findActiveMultipleChoice(null, null);

        assertThat(result).extracting(Question::getId).containsExactly(activeMultipleChoice.getId());
    }

    @Test
    void findActiveMultipleChoice_filtersByCategoryAndLevel_whenProvided() {
        Question matching = save("현재완료", QuestionType.MULTIPLE_CHOICE, QuestionLevel.INTERMEDIATE,
            QuestionStatus.ACTIVE, "일치하는 문제", LocalDateTime.now());
        save("관계대명사", QuestionType.MULTIPLE_CHOICE, QuestionLevel.INTERMEDIATE, QuestionStatus.ACTIVE,
            "다른 카테고리 문제", LocalDateTime.now());
        save("현재완료", QuestionType.MULTIPLE_CHOICE, QuestionLevel.ADVANCED, QuestionStatus.ACTIVE,
            "다른 난이도 문제", LocalDateTime.now());

        List<Question> result = questionRepository.findActiveMultipleChoice("현재완료", QuestionLevel.INTERMEDIATE);

        assertThat(result).extracting(Question::getId).containsExactly(matching.getId());
    }

    @Test
    void findActiveMultipleChoice_returnsEmptyList_whenNoQuestionMatches() {
        save("현재완료", QuestionType.FILL_IN_BLANK, QuestionLevel.BASIC, QuestionStatus.ACTIVE,
            "빈칸 문제", LocalDateTime.now());

        List<Question> result = questionRepository.findActiveMultipleChoice(null, null);

        assertThat(result).isEmpty();
    }

    private Question save(String category, QuestionType type, QuestionLevel level, QuestionStatus status,
        String text, LocalDateTime createdAt) {
        Question question = Question.builder()
            .category(category)
            .type(type)
            .level(level)
            .text(text)
            .choices(List.of("a", "b"))
            .answer("a")
            .explanation("해설")
            .build();
        ReflectionTestUtils.setField(question, "createdAt", createdAt);
        if (status == QuestionStatus.ACTIVE || status == QuestionStatus.INACTIVE) {
            question.activate();
        }
        if (status == QuestionStatus.INACTIVE) {
            question.deactivate();
        }
        return questionRepository.saveAndFlush(question);
    }
}
