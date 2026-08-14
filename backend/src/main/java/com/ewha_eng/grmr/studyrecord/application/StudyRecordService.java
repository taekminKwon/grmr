package com.ewha_eng.grmr.studyrecord.application;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberNotFoundException;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionNotFoundException;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordNotFoundException;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordReader;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordStore;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StudyRecordService {

    private final MemberReader memberReader;
    private final QuestionRepository questionRepository;
    private final StudyRecordReader studyRecordReader;
    private final StudyRecordStore studyRecordStore;

    @Transactional
    public StudyRecord submitPracticeAnswer(Long memberId, Long questionId, String answer) {
        Member member = memberReader.findById(memberId)
            .orElseThrow(() -> new MemberNotFoundException("회원을 찾을 수 없습니다."));
        Question question = questionRepository.findById(questionId)
            .orElseThrow(() -> new QuestionNotFoundException("문제를 찾을 수 없습니다."));
        question.validateAvailableForPractice();

        return studyRecordStore.save(StudyRecord.createPracticeAttempt(member, question, answer));
    }

    @Transactional(readOnly = true)
    public Page<StudyRecord> getMyPracticeRecords(Long memberId, String category, Pageable pageable) {
        return studyRecordReader.search(memberId, category, pageable);
    }

    @Transactional(readOnly = true)
    public StudyRecord getMyPracticeRecord(Long memberId, Long recordId) {
        return studyRecordReader.findByIdAndMemberId(recordId, memberId)
            .orElseThrow(() -> new StudyRecordNotFoundException("학습 기록을 찾을 수 없습니다."));
    }
}
