package com.ewha_eng.grmr.studyrecord.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ewha_eng.grmr.assignment.domain.StudentNotFoundException;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.studyrecord.domain.InvalidStudyRecordSearchException;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordReader;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordRollup;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordType;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class StudyRecordAdminServiceTest {

    private static final LocalDate FIXED_TODAY = LocalDate.of(2026, 8, 18);

    @Mock
    private MemberReader memberReader;

    @Mock
    private StudyRecordReader studyRecordReader;

    private StudyRecordAdminService service;

    @BeforeEach
    void setUp() {
        Clock fixedClock = Clock.fixed(FIXED_TODAY.atStartOfDay(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC);
        service = new StudyRecordAdminService(memberReader, studyRecordReader, fixedClock);
    }

    private Member student(Long id) {
        Member member = Member.builder()
            .loginId("student01")
            .password("hashed-password")
            .name("김민수")
            .type(MemberType.STUDENT)
            .build();
        ReflectionTestUtils.setField(member, "id", id);
        return member;
    }

    @Test
    void search_defaultsPeriodTo30Days_whenPeriodIsNotGiven() {
        when(studyRecordReader.searchRollups(isNull(), any(), any(), isNull(), eq(PageRequest.of(0, 20))))
            .thenReturn(new PageImpl<>(List.of()));

        service.search(null, null, null, 0, 20);

        verify(studyRecordReader).searchRollups(isNull(),
            eq(LocalDate.of(2026, 7, 20).atStartOfDay()),
            eq(LocalDate.of(2026, 8, 19).atStartOfDay()),
            isNull(), eq(PageRequest.of(0, 20)));
    }

    @Test
    void search_resolves7dPeriod_toLast7DaysInclusiveOfToday() {
        when(studyRecordReader.searchRollups(any(), any(), any(), any(), any()))
            .thenReturn(new PageImpl<>(List.of()));

        service.search(null, "7d", null, 0, 20);

        verify(studyRecordReader).searchRollups(isNull(),
            eq(LocalDate.of(2026, 8, 12).atStartOfDay()),
            eq(LocalDate.of(2026, 8, 19).atStartOfDay()),
            isNull(), eq(PageRequest.of(0, 20)));
    }

    @Test
    void search_parsesTypeFilter_intoEnum() {
        when(studyRecordReader.searchRollups(any(), any(), any(), any(), any()))
            .thenReturn(new PageImpl<>(List.of()));

        service.search(null, "30d", "ASSIGNMENT", 0, 20);

        verify(studyRecordReader).searchRollups(isNull(), any(), any(), eq(StudyRecordType.ASSIGNMENT), any());
    }

    @Test
    void search_throwsInvalidStudyRecordSearchException_whenPeriodIsNotAllowedValue() {
        assertThatThrownBy(() -> service.search(null, "14d", null, 0, 20))
            .isInstanceOf(InvalidStudyRecordSearchException.class);

        verify(studyRecordReader, never()).searchRollups(any(), any(), any(), any(), any());
    }

    @Test
    void search_throwsInvalidStudyRecordSearchException_whenTypeIsNotAllowedValue() {
        assertThatThrownBy(() -> service.search(null, null, "QUIZ", 0, 20))
            .isInstanceOf(InvalidStudyRecordSearchException.class);

        verify(studyRecordReader, never()).searchRollups(any(), any(), any(), any(), any());
    }

    @Test
    void search_throwsInvalidStudyRecordSearchException_whenPageIsNegative() {
        assertThatThrownBy(() -> service.search(null, null, null, -1, 20))
            .isInstanceOf(InvalidStudyRecordSearchException.class);
    }

    @Test
    void search_throwsInvalidStudyRecordSearchException_whenSizeIsBelowMinimum() {
        assertThatThrownBy(() -> service.search(null, null, null, 0, 0))
            .isInstanceOf(InvalidStudyRecordSearchException.class);
    }

    @Test
    void search_throwsInvalidStudyRecordSearchException_whenSizeExceedsMaximum() {
        assertThatThrownBy(() -> service.search(null, null, null, 0, 101))
            .isInstanceOf(InvalidStudyRecordSearchException.class);
    }

    @Test
    void search_validatesStudentExists_beforeQueryingRollups_whenStudentIdIsGiven() {
        when(memberReader.findById(501L)).thenReturn(Optional.of(student(501L)));
        when(studyRecordReader.searchRollups(any(), any(), any(), any(), any()))
            .thenReturn(new PageImpl<>(List.of()));

        service.search(501L, null, null, 0, 20);

        verify(studyRecordReader).searchRollups(eq(501L), any(), any(), any(), any());
    }

    @Test
    void search_throwsStudentNotFound_whenStudentIdDoesNotResolveToAnyMember() {
        when(memberReader.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.search(999L, null, null, 0, 20))
            .isInstanceOf(StudentNotFoundException.class);

        verify(studyRecordReader, never()).searchRollups(any(), any(), any(), any(), any());
    }

    @Test
    void search_throwsStudentNotFound_whenMemberExistsButIsNotAStudent() {
        Member admin = Member.builder()
            .loginId("admin01")
            .password("hashed-password")
            .name("관리자")
            .type(MemberType.ADMIN)
            .build();
        ReflectionTestUtils.setField(admin, "id", 777L);
        when(memberReader.findById(777L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> service.search(777L, null, null, 0, 20))
            .isInstanceOf(StudentNotFoundException.class);

        verify(studyRecordReader, never()).searchRollups(any(), any(), any(), any(), any());
    }

    @Test
    void search_returnsRollupsFromReader() {
        StudyRecordRollup rollup = new StudyRecordRollup(501L, "김민수", LocalDate.of(2026, 8, 15),
            StudyRecordType.PRACTICE, 20, 16);
        when(studyRecordReader.searchRollups(any(), any(), any(), any(), any()))
            .thenReturn(new PageImpl<>(List.of(rollup)));

        Page<StudyRecordRollup> result = service.search(null, null, null, 0, 20);

        assertThat(result.getContent()).containsExactly(rollup);
    }
}
