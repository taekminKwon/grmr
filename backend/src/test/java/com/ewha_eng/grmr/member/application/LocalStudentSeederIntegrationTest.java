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
    "spring.datasource.url=jdbc:h2:mem:localStudentSeederTest;MODE=PostgreSQL",
    "local.admin.login-id=admin",
    "local.admin.password=password",
    "local.admin.name=Local Admin",
    "local.student.seed-enabled=true",
    "local.student.login-id=student",
    "local.student.password=password",
    "local.student.name=Local Student"
})
@Transactional
class LocalStudentSeederIntegrationTest {

    @Autowired
    private LocalStudentSeeder localStudentSeeder;

    @Autowired
    private MemberReader memberReader;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void applicationRunner_seedsStudentWithBcryptPassword_onLocalProfileStartup() {
        Member student = memberReader.findByLoginId("student").orElseThrow();

        assertThat(student.getType()).isEqualTo(MemberType.STUDENT);
        assertThat(student.getName()).isEqualTo("Local Student");
        assertThat(student.getPassword()).isNotEqualTo("password");
        assertThat(passwordEncoder.matches("password", student.getPassword())).isTrue();
    }

    @Test
    void run_isIdempotent_andDoesNotRehashOnRerun() {
        Member beforeRerun = memberReader.findByLoginId("student").orElseThrow();
        String hashBeforeRerun = beforeRerun.getPassword();

        localStudentSeeder.run(null);

        Member afterRerun = memberReader.findByLoginId("student").orElseThrow();
        assertThat(afterRerun.getId()).isEqualTo(beforeRerun.getId());
        assertThat(afterRerun.getPassword()).isEqualTo(hashBeforeRerun);
    }
}
