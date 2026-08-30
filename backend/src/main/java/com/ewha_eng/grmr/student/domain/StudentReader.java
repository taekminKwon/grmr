package com.ewha_eng.grmr.student.domain;

import com.ewha_eng.grmr.member.domain.Member;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface StudentReader {

    /**
     * Students (type STUDENT) matching keyword (name, contains, case-insensitive) and exact
     * studentGroup, ordered by name ascending then id ascending for stable pagination.
     */
    Page<Member> search(String keyword, String studentGroup, Pageable pageable);

    /**
     * Batched study-history and pending-assignment aggregates for exactly the given students,
     * keyed by member id, computed in a bounded number of queries regardless of page size.
     */
    Map<Long, StudentAggregate> aggregatesFor(List<Member> students, LocalDate today);
}
