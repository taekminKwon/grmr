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
public class LocalAdminSeeder implements ApplicationRunner {

    private final MemberReader memberReader;
    private final MemberStore memberStore;
    private final PasswordEncoder passwordEncoder;
    private final String loginId;
    private final String rawPassword;
    private final String name;

    public LocalAdminSeeder(
        MemberReader memberReader,
        MemberStore memberStore,
        PasswordEncoder passwordEncoder,
        @Value("${local.admin.login-id:}") String loginId,
        @Value("${local.admin.password:}") String rawPassword,
        @Value("${local.admin.name:}") String name
    ) {
        this.memberReader = memberReader;
        this.memberStore = memberStore;
        this.passwordEncoder = passwordEncoder;
        this.loginId = loginId;
        this.rawPassword = rawPassword;
        this.name = name;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (loginId.isBlank() || rawPassword.isBlank() || name.isBlank()) {
            throw new LocalAdminSeedConfigurationException();
        }

        if (memberReader.findByLoginId(loginId).isPresent()) {
            return;
        }

        memberStore.save(Member.builder()
            .loginId(loginId)
            .password(passwordEncoder.encode(rawPassword))
            .name(name)
            .type(MemberType.ADMIN)
            .build());
    }
}
