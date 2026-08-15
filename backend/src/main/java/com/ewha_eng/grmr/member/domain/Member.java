package com.ewha_eng.grmr.member.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String loginId;
    private String password;
    private String name;

    @Enumerated(EnumType.STRING)
    private MemberType type;

    private String studentGroup;

    @Builder
    private Member(String loginId, String password, String name, MemberType type, String studentGroup) {
        this.loginId = loginId;
        this.password = password;
        this.name = name;
        this.type = type;
        this.studentGroup = studentGroup;
    }

    public boolean isStudent() {
        return this.type == MemberType.STUDENT;
    }

    public boolean isAdmin() {
        return this.type == MemberType.ADMIN;
    }
}
