-- GH #142: Activity status only offered Pending/Completed; add Ongoing so PAs can
-- mark an activity as in-progress instead of leaving it "pending" the whole time.
alter table project_activities drop constraint project_activities_status_check;
alter table project_activities
  add constraint project_activities_status_check
  check (status in ('pending', 'ongoing', 'completed'));
