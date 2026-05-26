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
const INITIAL_DATA_CACHE_TTL_SECONDS = 60;
const INITIAL_DATA_CACHE_MAX_CHARS = 90000;
const ARCHIVE_DIFF_HEADERS = ['check_setter_active', 'check_checker_active'];
const EDITABLE_MASTER_SHEETS = ['app_schedule', 'app_pr', 'app_pr_targets'];
const CYCLE_BASE_DATE = new Date(2026, 3, 28); // 火曜日
const MASTER_ID_CONFIG = {
  app_schedule: { aliases: ['schedule_id', 'ID', 'id'], prefix: 'SCH' },
  app_pr: { aliases: ['pr_id', 'PR ID', 'PR', 'ID', 'id'], prefix: '' },
  app_pr_targets: { aliases: ['pr_target_id', '紐付けID', 'ID', 'id'], prefix: 'PRT' }
};

const PR_FIELD_ALIASES = {
  pr_id: ['pr_id', 'PR ID', 'PR', 'ID', 'id'],
  name: ['name', '名称', 'タイトル', '見出し', 'PRタイトル'],
  pr_text: ['pr_text', 'PR本文', '本文'],
  start_date: ['start_date', '開始日', '開始'],
  end_date: ['end_date', '終了日', '終了'],
  notes: ['notes', '備考'],
  target_ids: ['target_ids', '紐付けID', '対象ID', 'PRが入るメルマガ', '紐付けメルマガ'],
  is_inactive: ['is_inactive', '配信停止', '配信終了', '停止', '無効'],
  is_draft: ['is_draft', '下書き']
};

const PR_TARGET_FIELD_ALIASES = {
  pr_target_id: ['pr_target_id', '紐付けID', 'ID', 'id'],
  pr_id: ['pr_id', 'PR ID', 'PR', 'ID', 'id'],
  schedule_id: ['schedule_id', 'スケジュールID', '配信ID'],
  mail_name: ['mail_name', 'メルマガ名', '対象メルマガ'],
  source_row: ['source_row', '元行', '元の行'],
  target_index: ['target_index', '表示順', '対象順'],
  is_inactive: ['is_inactive', '配信停止', '配信終了', '停止', '無効']
};

const SCHEDULE_FIELD_ALIASES = {
  schedule_id: ['schedule_id', 'ID', 'id'],
  mail_name: ['mail_name', 'メルマガ名'],
  mail_content: ['mail_content', 'メルマガ内容', 'メルマガ詳細内容'],
  mail_content_extract: ['mail_content_extract', 'メルマガ内容(抽出)'],
  mail_content_free: ['mail_content_free', 'メルマガ内容(フリー)'],
  weekday: ['weekday', '曜日'],
  hour: ['hour', '時間'],
  mail_type: ['mail_type', 'category', '種別'],
  sub_category: ['sub_category', 'サブカテゴリ', '担当部署'],
  format: ['format', '形式'],
  delivery_count: ['delivery_count', '通数'],
  assignee: ['assignee', '設定者'],
  reviewer: ['reviewer', '確認者'],
  start_date: ['start_date', '開始日', '開始'],
  end_date: ['end_date', '終了日', '終了'],
  pr: ['pr', 'PR'],
  notes: ['notes', '備考'],
  job_url: ['job_url', '自動求人特集URL', '自動求人特集_URL', '求人URL', 'URL'],
  auto_job_feature_id: ['auto_job_feature_id', '自動求人特集ID', '自動求人特集_ID'],
  target_age: ['target_age', '対象年齢', 'USER_年齢'],
  target_address: ['target_address', '対象現住所', 'USER_現住所'],
  user_desired_location: ['user_desired_location', 'USER_希望勤務地', '希望勤務地'],
  user_experience_job: ['user_experience_job', 'USER_経験職種', '経験職種'],
  user_desired_job: ['user_desired_job', 'USER_希望職種', '希望職種'],
  user_other_condition: ['user_other_condition', 'USER_その他条件'],
  parameter: ['parameter', 'parameters', 'パラメータ'],
  job_location: ['job_location', 'JOB_勤務地'],
  job_type: ['job_type', 'JOB_職種'],
  job_keyword: ['job_keyword', 'JOB_フリーワード', 'フリーワード'],
  is_new: ['is_new', 'new_flag', '新規'],
  is_verifying: ['is_verifying', '検証中', 'verifying_flag'],
  current_job_count: ['current_job_count', '現在求人数', '最新求人数', '求人数', '自動求人特集_求人数'],
  auto_job_other_condition: ['auto_job_other_condition', '自動求人特集_その他条件'],
  cycle: ['cycle', 'サイクル'],
  current_week_cycle: ['current_week_cycle', '今週サイクル(内部)'],
  current_week_inactive: ['current_week_inactive', '今週非配信(内部)'],
  is_inactive: ['is_inactive', '配信終了', '配信停止'],
  stop_date: ['stop_date', '停止日'],
  resume_date: ['resume_date', '再開日'],
  is_draft: ['is_draft', '下書き'],
  is_fixed: ['is_fixed', '確定済']
};

const CHECK_STATUS_FIELD_ALIASES = {
  item_id: ['item_id'],
  field: ['field'],
  is_active: ['is_active'],
  updated_at: ['updated_at'],
  schedule_id: ['ID', 'schedule_id', 'id'],
  original_date: ['original_date'],
  delivery_date: ['delivery_date'],
  hour: ['hour', '時間'],
  weekday: ['weekday', '曜日'],
  start_date: ['開始日', 'start_date', '開始'],
  end_date: ['終了日', 'end_date', '終了'],
  cycle: ['cycle', 'サイクル'],
  mail_name: ['mail_name', 'メルマガ名'],
  mail_content_extract: ['mail_content_extract', 'メルマガ内容(抽出)'],
  mail_content_free: ['mail_content_free', 'メルマガ内容(フリー)'],
  job_url: ['job_url', '自動求人特集URL', '自動求人特集_URL', '求人URL', 'URL'],
  auto_job_feature_id: ['auto_job_feature_id', '自動求人特集ID', '自動求人特集_ID'],
  target_age: ['target_age', '対象年齢', 'USER_年齢'],
  target_address: ['target_address', '対象現住所', 'USER_現住所'],
  user_desired_location: ['user_desired_location', 'USER_希望勤務地', '希望勤務地'],
  user_experience_job: ['user_experience_job', 'USER_経験職種', '経験職種'],
  user_desired_job: ['user_desired_job', 'USER_希望職種', '希望職種'],
  user_other_condition: ['user_other_condition', 'USER_その他条件'],
  parameter: ['parameter', 'parameters', 'パラメータ'],
  job_location: ['job_location', 'JOB_勤務地'],
  job_type: ['job_type', 'JOB_職種'],
  job_keyword: ['job_keyword', 'JOB_フリーワード', 'フリーワード'],
  is_new: ['is_new', '新規', 'new_flag'],
  is_verifying: ['is_verifying', '検証中', 'verifying_flag'],
  current_job_count: ['current_job_count', '現在求人数', '最新求人数', '求人数', '自動求人特集_求人数'],
  auto_job_other_condition: ['auto_job_other_condition', '自動求人特集_その他条件'],
  override_fields: ['override_fields'],
  delivery_count: ['delivery_count', '通数'],
  assignee: ['assignee', '設定者'],
  reviewer: ['reviewer', '確認者'],
  notes: ['notes', '備考'],
  category: ['category', 'mail_type', '種別'],
  sub_category: ['sub_category', 'サブカテゴリ', '担当部署'],
  format: ['format', '形式'],
  pr: ['pr', 'PR', 'PR ID', 'pr_id'],
  confirmed_by: ['confirmed_by'],
  confirmed_at: ['confirmed_at']
};

const DEPRECATED_SCHEDULE_HEADERS = ['job_count_updated_at', '求人数最終取得日時'];
