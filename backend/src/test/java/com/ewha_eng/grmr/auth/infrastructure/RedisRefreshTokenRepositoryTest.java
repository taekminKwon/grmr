package com.ewha_eng.grmr.auth.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Requires a local Docker daemon to pull and start the redis:7-alpine image via Testcontainers.
 * Could not be executed in the sandbox this was written in (no Docker daemon available there) —
 * run it locally once Docker is running to confirm it's actually green.
 */
@Tag("integration")
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class RedisRefreshTokenRepositoryTest {

    @Container
    @ServiceConnection(name = "redis")
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
        .withExposedPorts(6379);

    @Autowired
    private RedisRefreshTokenRepository repository;

    @Test
    void save_thenFindByMemberId_returnsStoredToken() {
        repository.save(1L, "refresh-token", Duration.ofMinutes(5).toMillis());

        Optional<String> found = repository.findByMemberId(1L);

        assertThat(found).contains("refresh-token");
    }

    @Test
    void findByMemberId_returnsEmpty_whenNothingStored() {
        Optional<String> found = repository.findByMemberId(999L);

        assertThat(found).isEmpty();
    }

    @Test
    void deleteByMemberId_removesStoredToken() {
        repository.save(2L, "refresh-token", Duration.ofMinutes(5).toMillis());

        repository.deleteByMemberId(2L);

        assertThat(repository.findByMemberId(2L)).isEmpty();
    }

    @Test
    void save_overwritesPreviousToken_forSameMember() {
        repository.save(3L, "first-token", Duration.ofMinutes(5).toMillis());
        repository.save(3L, "second-token", Duration.ofMinutes(5).toMillis());

        assertThat(repository.findByMemberId(3L)).contains("second-token");
    }
}
