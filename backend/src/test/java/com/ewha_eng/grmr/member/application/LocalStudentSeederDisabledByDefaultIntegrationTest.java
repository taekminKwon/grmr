package com.ewha_eng.grmr.member.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.member.domain.MemberType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("local")
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:localStudentSeederDisabledTest;MODE=PostgreSQL",
    "local.admin.login-id=admin",
    "local.admin.password=password",
    "local.admin.name=Local Admin"
})
@Transactional
class LocalStudentSeederDisabledByDefaultIntegrationTest {

    @Autowired
    private MemberReader memberReader;

    @Test
    void applicationStartsUp_withoutSeedingStudent_whenSeedNotExplicitlyEnabled() {
        assertThat(memberReader.findByLoginId("student")).isEmpty();

        Member admin = memberReader.findByLoginId("admin").orElseThrow();
        assertThat(admin.getType()).isEqualTo(MemberType.ADMIN);
    }
}
