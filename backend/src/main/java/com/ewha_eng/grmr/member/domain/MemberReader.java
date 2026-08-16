package com.ewha_eng.grmr.member.domain;

import java.util.Optional;

public interface MemberReader {

    Optional<Member> findById(Long id);

    Optional<Member> findByLoginId(String loginId);

    long countByTypeAndStudentGroup(MemberType type, String studentGroup);
}
