package com.ewha_eng.grmr.member.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
class LocalAdminSeederTest {

    @Mock
    private MemberReader memberReader;

    @Mock
    private MemberStore memberStore;

    @Mock
    private PasswordEncoder passwordEncoder;

    private LocalAdminSeeder seeder(String loginId, String rawPassword, String name) {
        return new LocalAdminSeeder(memberReader, memberStore, passwordEncoder, loginId, rawPassword, name);
    }

    @Test
    void run_createsAdminWithEncodedPassword_whenLoginIdNotFound() {
        when(memberReader.findByLoginId("admin")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password")).thenReturn("bcrypt-hash");

        seeder("admin", "password", "Local Admin").run(null);

        ArgumentCaptor<Member> captor = ArgumentCaptor.forClass(Member.class);
        verify(memberStore).save(captor.capture());
        Member saved = captor.getValue();
        assertThat(saved.getLoginId()).isEqualTo("admin");
        assertThat(saved.getPassword()).isEqualTo("bcrypt-hash");
        assertThat(saved.getPassword()).isNotEqualTo("password");
        assertThat(saved.getName()).isEqualTo("Local Admin");
        assertThat(saved.getType()).isEqualTo(MemberType.ADMIN);
        assertThat(saved.isAdmin()).isTrue();
    }

    @Test
    void run_skipsCreation_whenLoginIdAlreadyExists() {
        Member existing = Member.builder()
            .loginId("admin")
            .password("already-hashed")
            .name("Local Admin")
            .type(MemberType.ADMIN)
            .build();
        when(memberReader.findByLoginId("admin")).thenReturn(Optional.of(existing));

        seeder("admin", "password", "Local Admin").run(null);

        verify(memberStore, never()).save(any());
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void run_throwsConfigurationException_whenLoginIdBlank() {
        assertThatThrownBy(() -> seeder("", "password", "Local Admin").run(null))
            .isInstanceOf(LocalAdminSeedConfigurationException.class);

        verify(memberStore, never()).save(any());
    }

    @Test
    void run_throwsConfigurationException_whenPasswordBlank() {
        assertThatThrownBy(() -> seeder("admin", "  ", "Local Admin").run(null))
            .isInstanceOf(LocalAdminSeedConfigurationException.class);

        verify(memberStore, never()).save(any());
    }

    @Test
    void run_throwsConfigurationException_whenNameBlank() {
        assertThatThrownBy(() -> seeder("admin", "password", "").run(null))
            .isInstanceOf(LocalAdminSeedConfigurationException.class);

        verify(memberStore, never()).save(any());
    }
}
