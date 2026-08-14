package com.ewha_eng.grmr.auth.infrastructure;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ewha_eng.grmr.member.domain.MemberType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/**
 * A refresh token has no "type" claim, so it must never reach getMemberType().name()
 * in JwtAuthenticationFilter; it should be treated as unauthenticated instead of causing an NPE/500.
 */
@SpringBootTest
@AutoConfigureMockMvc
class JwtAuthenticationFilterSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void protectedEndpoint_returns401TokenInvalid_whenBearerTokenIsARefreshToken() throws Exception {
        String refreshToken = jwtTokenProvider.createRefreshToken(1L);

        mockMvc.perform(get("/api/me/profile")
                .header("Authorization", "Bearer " + refreshToken))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("TOKEN_INVALID"));
    }

    @Test
    void protectedEndpoint_doesNotReturn401_whenBearerTokenIsAValidAccessToken() throws Exception {
        String accessToken = jwtTokenProvider.createAccessToken(1L, MemberType.STUDENT);

        mockMvc.perform(get("/api/me/profile")
                .header("Authorization", "Bearer " + accessToken))
            .andExpect(status().isNotFound());
    }

    @Test
    void protectedEndpoint_returns401TokenInvalid_whenBearerTokenIsMalformed() throws Exception {
        mockMvc.perform(get("/api/me/profile")
                .header("Authorization", "Bearer not-a-jwt"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("TOKEN_INVALID"));
    }
}
