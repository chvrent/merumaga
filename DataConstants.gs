/**
 * DataConstants.gs
 * 定数・フィールドエイリアス定義
 * すべての .gs ファイルで参照される定数をここに集約する。
 */

const DEFAULT_SOURCE_SPREADSHEET_ID = '1hr-bf6g0Lhe9tuTiGHjhM9uyfKOmiQ9ZCpgD5kVdnrs';
const SOURCE_SPREADSHEET_ID_PROPERTY = 'SOURCE_SPREADSHEET_ID';
const SCHEDULE_SHEET_NAME = 'app_schedule';
const SCHEDULE_ARCHIVE_SHEET_NAME = 'app_schedule_archives';
const COMMENTS_SHEET_NAME = 'app_comments';
const EXCEPTIONS_SHEET_NAME = 'app_exceptions';
const CHECK_STATUS_SHEET_NAME = 'app_check_status';
const LOG_ARCHIVE_RETENTION_DAYS = 90;
const JOB_COUNT_REFRESH_INTERVAL_HOURS = 12;
const INITIAL_DATA_CACHE_TTL_SECONDS = 300;
const INITIAL_DATA_CACHE_MAX_CHARS = 95000;
const ARCHIVE_DIFF_HEADERS = ['check_setter_active', 'check_checker_active'];
const EDITABLE_MASTER_SHEETS = ['app_schedule', 'app_pr', 'app_pr_targets'];
const CYCLE_BASE_DATE = new Date(2026, 3, 28); // 火曜日
const MASTER_ID_CONFIG = {
  app_schedule: { aliases: ['schedule_id', 'ID', 'id'], prefix: 'SCH' },
  app_pr: { aliases: ['pr_id', 'PR ID', 'PR', 'ID', 'id'], prefix: '' },
  app_pr_targets: { aliases: ['pr_target_id', '紐付けID', 'ID', 'id'], prefix: 'PRT' }
};

const PR_FIELD_ALIASES = {
  pr_id: ['PR ID/pr_id', 'ID/pr_id', 'ID', 'pr_id'],
  name: ['PRタイトル/name', '名称/name', '名称', 'name'],
  start_date: ['開始日/start_date', '開始日', 'start_date'],
  end_date: ['終了日/end_date', '終了日', 'end_date'],
  pr_text: ['PR本文/pr_text', 'PR本文', 'pr_text'],
  notes: ['備考/notes', '備考', 'notes'],
  is_inactive: ['配信終了/is_inactive', '配信終了', 'is_inactive']
};

const PR_TARGET_FIELD_ALIASES = {
  pr_id: ['ID/pr_id', 'ID', 'pr_id'],
  mail_name: ['メルマガ名/mail_name', 'メルマガ名', 'mail_name']
};

// SCHEDULE_FIELD_ALIASES / CHECK_STATUS_FIELD_ALIASES 共通フィールド
const SHARED_FIELD_ALIASES_ = {
  hour: ['hour', '時間', '時間/hour'],
  weekday: ['weekday', '曜日', '曜日/weekday'],
  cycle: ['cycle', 'サイクル', 'サイクル/cycle'],
  mail_name: ['mail_name', 'メルマガ名', 'メルマガ名/mail_name'],
  mail_content_extract: ['mail_content_extract', 'メルマガ内容(抽出)', 'メルマガ内容(抽出)/mail_content_extract'],
  mail_content_free: ['mail_content_free', 'メルマガ内容(フリー)', 'メルマガ内容(フリー)/mail_content_free'],
  job_url: ['job_url', '自動求人特集URL', '自動求人特集_URL', '求人URL', 'URL', '自動求人特集_URL/job_url'],
  auto_job_feature_id: ['auto_job_feature_id', '自動求人特集ID', '自動求人特集_ID', '自動求人特集_ID/auto_job_feature_id'],
  target_age: ['target_age', '対象年齢', 'USER_年齢', 'USER_年齢/target_age'],
  target_address: ['target_address', '対象現住所', 'USER_現住所', 'USER_現住所/target_address'],
  user_desired_location: ['user_desired_location', 'USER_希望勤務地', '希望勤務地', 'USER_希望勤務地/user_desired_location'],
  user_experience_job: ['user_experience_job', 'USER_経験職種', '経験職種', 'USER_経験職種/user_experience_job'],
  user_desired_job: ['user_desired_job', 'USER_希望職種', '希望職種', 'USER_希望職種/user_desired_job'],
  user_other_condition: ['user_other_condition', 'USER_その他条件', 'USER_その他条件/user_other_condition'],
  parameter: ['parameter', 'parameters', 'パラメータ', 'パラメータ/parameter'],
  job_location: ['job_location', 'JOB_勤務地', 'JOB_勤務地/job_location'],
  job_type: ['job_type', 'JOB_職種', 'JOB_職種/job_type'],
  job_keyword: ['job_keyword', 'JOB_フリーワード', 'フリーワード', 'JOB_フリーワード/job_keyword'],
  is_verifying: ['is_verifying', '検証中', '検証中/is_verifying', 'verifying_flag'],
  current_job_count: ['current_job_count', '現在求人数', '最新求人数', '求人数', '自動求人特集_求人数', '自動求人特集_求人数/current_job_count'],
  auto_job_other_condition: ['auto_job_other_condition', '自動求人特集_その他条件', '自動求人特集_その他条件/auto_job_other_condition'],
};

const SCHEDULE_FIELD_ALIASES = Object.assign({}, SHARED_FIELD_ALIASES_, {
  schedule_id: ['schedule_id', 'ID', 'id', 'ID/schedule_id'],
  mail_content: ['mail_content', 'メルマガ内容', 'メルマガ詳細内容'],
  mail_type: ['mail_type', 'category', '種別', '種別/mail_type'],
  sub_category: ['sub_category', 'サブカテゴリ', '担当部署', '担当部署/sub_category'],
  format: ['format', '形式', '形式/format'],
  delivery_count: ['delivery_count', '通数', '通数/delivery_count'],
  assignee: ['assignee', '設定者', '設定', '設定者/assignee', '設定/assignee'],
  reviewer: ['reviewer', '確認者', '確認', '確認者/reviewer', '確認/reviewer'],
  start_date: ['start_date', '開始日', '開始', '開始日/start_date'],
  end_date: ['end_date', '終了日', '終了', '終了日/end_date'],
  pr: ['pr', 'PR'],
  notes: ['notes', '備考', '備考/notes'],
  is_new: ['is_new', 'new_flag', '新規', '新規/is_new'],
  current_week_cycle: ['current_week_cycle', '今週サイクル(内部)', '今週サイクル(内部)/current_week_cycle'],
  current_week_inactive: ['current_week_inactive', '今週非配信(内部)', '今週非配信(内部)/current_week_inactive'],
  is_inactive: ['is_inactive', '配信終了', '配信停止', '配信終了/is_inactive'],
  is_draft: ['is_draft', '下書き', '下書き/is_draft'],
  is_fixed: ['is_fixed', '確定済', '確定済/is_fixed'],
});

const CHECK_STATUS_FIELD_ALIASES = Object.assign({}, SHARED_FIELD_ALIASES_, {
  item_id: ['item_id'],
  field: ['field'],
  is_active: ['is_active'],
  updated_at: ['updated_at'],
  schedule_id: ['ID', 'schedule_id', 'id', 'ID/schedule_id'],
  original_date: ['original_date'],
  delivery_date: ['delivery_date'],
  start_date: ['開始日', 'start_date', '開始', '開始日/start_date'],
  end_date: ['終了日', 'end_date', '終了', '終了日/end_date'],
  is_new: ['is_new', '新規', 'new_flag', '新規/is_new'],
  delivery_count: ['delivery_count', '通数', '通数/delivery_count'],
  assignee: ['assignee', '設定者', '設定', '設定者/assignee', '設定/assignee'],
  reviewer: ['reviewer', '確認者', '確認', '確認者/reviewer', '確認/reviewer'],
  notes: ['notes', '備考', '備考/notes'],
  category: ['category', 'mail_type', '種別', '種別/mail_type'],
  sub_category: ['sub_category', 'サブカテゴリ', '担当部署', '担当部署/sub_category'],
  format: ['format', '形式', '形式/format'],
  pr: ['pr', 'PR', 'PR ID', 'pr_id'],
  override_fields: ['override_fields'],
  is_inactive: ['is_inactive', '配信終了', '配信停止', '配信終了/is_inactive'],
  is_draft: ['is_draft', '下書き', '下書き/is_draft'],
  is_fixed: ['is_fixed', '確定済', '確定済/is_fixed'],
});

const COMMENTS_FIELD_ALIASES = {
  schedule_id: ['schedule_id', 'ID', 'id', 'ID/schedule_id'],
  timestamp: ['timestamp', '投稿日時', '更新日時', '日時', '投稿日時/timestamp'],
  user: ['user', '投稿者', 'ユーザー', '投稿者/user'],
  comment_text: ['comment_text', 'コメント', '本文', 'コメント本文', 'コメント/comment_text'],
  target_date: ['target_date', '対象日', '配信日', '対象日/target_date']
};

const DEPRECATED_SCHEDULE_HEADERS = ['job_count_updated_at', '求人数最終取得日時'];
