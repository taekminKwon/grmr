package com.ewha_eng.grmr.studyrecord.infrastructure;

import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordReader;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordStore;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyRecordJpaRepository extends JpaRepository<StudyRecord, Long>, StudyRecordReader,
    StudyRecordStore {
}
