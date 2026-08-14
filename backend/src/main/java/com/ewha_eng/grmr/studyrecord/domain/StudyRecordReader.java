package com.ewha_eng.grmr.studyrecord.domain;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface StudyRecordReader {

    Optional<StudyRecord> findByIdAndMemberId(Long id, Long memberId);

    Page<StudyRecord> search(Long memberId, String category, Pageable pageable);
}
