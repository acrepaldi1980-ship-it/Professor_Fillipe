-- D-08: minors (13-17) must confirm that a guardian is aware. Recorded as a consent of kind 'guardian_ack'.
alter table consent_records drop constraint if exists consent_records_kind_check;
alter table consent_records add constraint consent_records_kind_check
  check (kind in ('terms', 'privacy', 'sensitive_religious', 'rehearsal_audio', 'guardian_ack'));
