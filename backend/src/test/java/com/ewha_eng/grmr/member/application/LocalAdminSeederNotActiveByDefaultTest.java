package com.ewha_eng.grmr.member.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

@SpringBootTest
class LocalAdminSeederNotActiveByDefaultTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void seederBean_isNotRegistered_whenLocalProfileIsNotActive() {
        assertThat(context.getBeanNamesForType(LocalAdminSeeder.class)).isEmpty();
    }
}
