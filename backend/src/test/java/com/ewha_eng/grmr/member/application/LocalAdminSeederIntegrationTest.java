package com.ewha_eng.grmr.member.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.member.domain.MemberType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("local")
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:localAdminSeederTest;MODE=PostgreSQL",
    "local.admin.login-id=admin",
    "local.admin.password=password",
    "local.admin.name=Local Admin"
})
@Transactional
class LocalAdminSeederIntegrationTest {

    @Autowired
    private LocalAdminSeeder localAdminSeeder;

    @Autowired
    private MemberReader memberReader;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void applicationRunner_seedsAdminWithBcryptPassword_onLocalProfileStartup() {
        Member admin = memberReader.findByLoginId("admin").orElseThrow();

        assertThat(admin.getType()).isEqualTo(MemberType.ADMIN);
        assertThat(admin.getName()).isEqualTo("Local Admin");
        assertThat(admin.getPassword()).isNotEqualTo("password");
        assertThat(passwordEncoder.matches("password", admin.getPassword())).isTrue();
    }

    @Test
    void run_isIdempotent_andDoesNotRehashOnRerun() {
        Member beforeRerun = memberReader.findByLoginId("admin").orElseThrow();
        String hashBeforeRerun = beforeRerun.getPassword();

        localAdminSeeder.run(null);

        Member afterRerun = memberReader.findByLoginId("admin").orElseThrow();
        assertThat(afterRerun.getId()).isEqualTo(beforeRerun.getId());
        assertThat(afterRerun.getPassword()).isEqualTo(hashBeforeRerun);
    }
}
