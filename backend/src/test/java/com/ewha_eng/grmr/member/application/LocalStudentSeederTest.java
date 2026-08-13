package com.ewha_eng.grmr.member.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.member.domain.MemberStore;
import com.ewha_eng.grmr.member.domain.MemberType;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class LocalStudentSeederTest {

    @Mock
    private MemberReader memberReader;

    @Mock
    private MemberStore memberStore;

    @Mock
    private PasswordEncoder passwordEncoder;

    private LocalStudentSeeder seeder(String seedEnabled, String loginId, String rawPassword, String name) {
        return new LocalStudentSeeder(memberReader, memberStore, passwordEncoder, seedEnabled, loginId, rawPassword, name);
    }

    @Test
    void run_createsStudentWithEncodedPassword_whenEnabledAndLoginIdNotFound() {
        when(memberReader.findByLoginId("student")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password")).thenReturn("bcrypt-hash");

        seeder("true", "student", "password", "Local Student").run(null);

        ArgumentCaptor<Member> captor = ArgumentCaptor.forClass(Member.class);
        verify(memberStore).save(captor.capture());
        Member saved = captor.getValue();
        assertThat(saved.getLoginId()).isEqualTo("student");
        assertThat(saved.getPassword()).isEqualTo("bcrypt-hash");
        assertThat(saved.getPassword()).isNotEqualTo("password");
        assertThat(saved.getName()).isEqualTo("Local Student");
        assertThat(saved.getType()).isEqualTo(MemberType.STUDENT);
        assertThat(saved.isStudent()).isTrue();
    }

    @Test
    void run_skipsCreation_whenLoginIdAlreadyExists() {
        Member existing = Member.builder()
            .loginId("student")
            .password("already-hashed")
            .name("Local Student")
            .type(MemberType.STUDENT)
            .build();
        when(memberReader.findByLoginId("student")).thenReturn(Optional.of(existing));

        seeder("true", "student", "password", "Local Student").run(null);

        verify(memberStore, never()).save(any());
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void run_skipsCreation_whenLoginIdConflictsWithDifferentType() {
        Member existingAdmin = Member.builder()
            .loginId("student")
            .password("already-hashed")
            .name("Someone Else")
            .type(MemberType.ADMIN)
            .build();
        when(memberReader.findByLoginId("student")).thenReturn(Optional.of(existingAdmin));

        seeder("true", "student", "password", "Local Student").run(null);

        verify(memberStore, never()).save(any());
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void run_throwsConfigurationException_whenEnabledAndLoginIdBlank() {
        assertThatThrownBy(() -> seeder("true", "", "password", "Local Student").run(null))
            .isInstanceOf(LocalStudentSeedConfigurationException.class);

        verify(memberStore, never()).save(any());
    }

    @Test
    void run_throwsConfigurationException_whenEnabledAndPasswordBlank() {
        assertThatThrownBy(() -> seeder("true", "student", "  ", "Local Student").run(null))
            .isInstanceOf(LocalStudentSeedConfigurationException.class);

        verify(memberStore, never()).save(any());
    }

    @Test
    void run_throwsConfigurationException_whenEnabledAndNameBlank() {
        assertThatThrownBy(() -> seeder("true", "student", "password", "").run(null))
            .isInstanceOf(LocalStudentSeedConfigurationException.class);

        verify(memberStore, never()).save(any());
    }

    @Test
    void run_doesNothing_whenSeedNotEnabled() {
        assertThatNoException().isThrownBy(() -> seeder("false", "", "", "").run(null));

        verify(memberReader, never()).findByLoginId(any());
        verify(memberStore, never()).save(any());
    }

    @Test
    void run_doesNothing_whenSeedEnabledFlagBlank() {
        assertThatNoException().isThrownBy(() -> seeder("", "student", "password", "Local Student").run(null));

        verify(memberReader, never()).findByLoginId(any());
        verify(memberStore, never()).save(any());
    }
}
