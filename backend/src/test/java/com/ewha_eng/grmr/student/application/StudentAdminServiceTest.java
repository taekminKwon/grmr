package com.ewha_eng.grmr.student.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.ewha_eng.grmr.assignment.domain.StudentNotFoundException;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.student.domain.InvalidStudentSearchException;
import com.ewha_eng.grmr.student.domain.StudentAggregate;
import com.ewha_eng.grmr.student.domain.StudentReader;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
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
class StudentAdminServiceTest {

    private static final LocalDate FIXED_TODAY = LocalDate.of(2026, 8, 19);

    @Mock
    private StudentReader studentReader;

    @Mock
    private MemberReader memberReader;

    private StudentAdminService service;

    @BeforeEach
    void setUp() {
        Clock fixedClock = Clock.fixed(FIXED_TODAY.atStartOfDay(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC);
        service = new StudentAdminService(studentReader, memberReader, fixedClock);
    }

    @Test
    void search_throws_whenPageIsNegative() {
        assertThatThrownBy(() -> service.search(null, null, -1, 20))
            .isInstanceOf(InvalidStudentSearchException.class);
    }

    @Test
    void search_throws_whenSizeIsBelowMinimum() {
        assertThatThrownBy(() -> service.search(null, null, 0, 0))
            .isInstanceOf(InvalidStudentSearchException.class);
    }

    @Test
    void search_throws_whenSizeExceedsMaximum() {
        assertThatThrownBy(() -> service.search(null, null, 0, 101))
            .isInstanceOf(InvalidStudentSearchException.class);
    }

    @Test
    void search_mapsMemberAndAggregate_intoStudentSummary() {
        Member student = student(501L, "김민수", "중1 A반");
        when(studentReader.search(eq("민수"), eq("중1 A반"), eq(PageRequest.of(0, 20))))
            .thenReturn(new PageImpl<>(List.of(student)));
        when(studentReader.aggregatesFor(eq(List.of(student)), eq(FIXED_TODAY)))
            .thenReturn(Map.of(501L, new StudentAggregate(LocalDate.of(2026, 8, 1), 128, 95, 1)));

        Page<StudentSummary> result = service.search("민수", "중1 A반", 0, 20);

        assertThat(result.getContent()).hasSize(1);
        StudentSummary summary = result.getContent().get(0);
        assertThat(summary.id()).isEqualTo(501L);
        assertThat(summary.name()).isEqualTo("김민수");
        assertThat(summary.studentGroup()).isEqualTo("중1 A반");
        assertThat(summary.lastStudiedAt()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(summary.totalQuestionCount()).isEqualTo(128);
        assertThat(summary.accuracy()).isEqualTo(74);
        assertThat(summary.pendingAssignmentCount()).isEqualTo(1);
    }

    @Test
    void search_fillsZeroDefaults_whenAggregateIsMissingForStudent() {
        Member student = student(501L, "김민수", "중1 A반");
        when(studentReader.search(eq(null), eq(null), eq(PageRequest.of(0, 20))))
            .thenReturn(new PageImpl<>(List.of(student)));
        when(studentReader.aggregatesFor(anyList(), eq(FIXED_TODAY))).thenReturn(Map.of());

        Page<StudentSummary> result = service.search(null, null, 0, 20);

        StudentSummary summary = result.getContent().get(0);
        assertThat(summary.lastStudiedAt()).isNull();
        assertThat(summary.totalQuestionCount()).isZero();
        assertThat(summary.accuracy()).isZero();
        assertThat(summary.pendingAssignmentCount()).isZero();
    }

    @Test
    void getDetail_returnsSummary_whenMemberIsStudent() {
        Member student = student(501L, "김민수", "중1 A반");
        when(memberReader.findById(501L)).thenReturn(Optional.of(student));
        when(studentReader.aggregatesFor(eq(List.of(student)), eq(FIXED_TODAY)))
            .thenReturn(Map.of(501L, new StudentAggregate(LocalDate.of(2026, 8, 1), 128, 95, 1)));

        StudentSummary summary = service.getDetail(501L);

        assertThat(summary.id()).isEqualTo(501L);
        assertThat(summary.accuracy()).isEqualTo(74);
    }

    @Test
    void getDetail_throwsStudentNotFound_whenMemberDoesNotExist() {
        when(memberReader.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getDetail(999L))
            .isInstanceOf(StudentNotFoundException.class);
    }

    @Test
    void getDetail_throwsStudentNotFound_whenMemberIsAdmin() {
        Member admin = Member.builder().loginId("admin1").password("h").name("관리자").type(MemberType.ADMIN).build();
        ReflectionTestUtils.setField(admin, "id", 999L);
        when(memberReader.findById(999L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> service.getDetail(999L))
            .isInstanceOf(StudentNotFoundException.class);
    }

    private Member student(Long id, String name, String group) {
        Member member = Member.builder()
            .loginId("login" + id)
            .password("hashed")
            .name(name)
            .type(MemberType.STUDENT)
            .studentGroup(group)
            .build();
        ReflectionTestUtils.setField(member, "id", id);
        return member;
    }
}
