package com.ewha_eng.grmr.member.application;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.member.domain.MemberStore;
import com.ewha_eng.grmr.member.domain.MemberType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("local")
public class LocalStudentSeeder implements ApplicationRunner {

    private final MemberReader memberReader;
    private final MemberStore memberStore;
    private final PasswordEncoder passwordEncoder;
    private final boolean seedEnabled;
    private final String loginId;
    private final String rawPassword;
    private final String name;

    public LocalStudentSeeder(
        MemberReader memberReader,
        MemberStore memberStore,
        PasswordEncoder passwordEncoder,
        @Value("${local.student.seed-enabled:false}") String seedEnabled,
        @Value("${local.student.login-id:}") String loginId,
        @Value("${local.student.password:}") String rawPassword,
        @Value("${local.student.name:}") String name
    ) {
        this.memberReader = memberReader;
        this.memberStore = memberStore;
        this.passwordEncoder = passwordEncoder;
        this.seedEnabled = "true".equalsIgnoreCase(seedEnabled.trim());
        this.loginId = loginId;
        this.rawPassword = rawPassword;
        this.name = name;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!seedEnabled) {
            return;
        }

        if (loginId.isBlank() || rawPassword.isBlank() || name.isBlank()) {
            throw new LocalStudentSeedConfigurationException();
        }

        if (memberReader.findByLoginId(loginId).isPresent()) {
            return;
        }

        memberStore.save(Member.builder()
            .loginId(loginId)
            .password(passwordEncoder.encode(rawPassword))
            .name(name)
            .type(MemberType.STUDENT)
            .build());
    }
}
