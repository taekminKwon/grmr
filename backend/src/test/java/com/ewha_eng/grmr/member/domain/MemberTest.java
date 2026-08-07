package com.ewha_eng.grmr.member.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MemberTest {

    @Test
    void isStudent_returnsTrue_whenTypeIsStudent() {
        Member member = Member.builder()
            .loginId("student01")
            .password("hashed-password")
            .name("김민수")
            .type(MemberType.STUDENT)
            .build();

        assertThat(member.isStudent()).isTrue();
        assertThat(member.isAdmin()).isFalse();
    }

    @Test
    void isAdmin_returnsTrue_whenTypeIsAdmin() {
        Member member = Member.builder()
            .loginId("admin01")
            .password("hashed-password")
            .name("권태민")
            .type(MemberType.ADMIN)
            .build();

        assertThat(member.isAdmin()).isTrue();
        assertThat(member.isStudent()).isFalse();
    }
}
