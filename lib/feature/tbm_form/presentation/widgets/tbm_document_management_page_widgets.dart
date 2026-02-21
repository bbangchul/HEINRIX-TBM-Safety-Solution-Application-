import 'package:flutter/material.dart';
import 'package:tbm_application_v2/core/theme/app_typography.dart';
import 'package:tbm_application_v2/core/theme/app_colors.dart';

/*
tbm_document_management_page_widgets.dart
----------------------------------------
Purpose:
문서 관리 화면에서 TBM 보고서(PDF) 목록을 검색/필터링/표시하기 위한 위젯 모음이다.

Scope:
- 타이틀 영역
- 검색 바
- 기간(일간/주간) 선택 세그먼트
- 빈 상태 안내
- 문서 카드 및 상태 배지

Design Note:
- 데이터 조회/필터링/정렬은 상위 페이지 또는 Notifier에서 수행한다.
*/

/*
TbmDocumentManagementTitle
--------------------------
Purpose:
문서 관리 페이지의 상단 타이틀/서브타이틀을 공통 위젯으로 제공한다.
*/
class TbmDocumentManagementTitle extends StatelessWidget {
  const TbmDocumentManagementTitle({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        RichText(
          text: TextSpan(
            style: TbmTypography.withPrimary(
              TbmTypography.tabTitle.copyWith(fontSize: TbmTypography.t18),
            ),
            children: const [
              TextSpan(text: '안전 문서 '),
              TextSpan(text: '이력', style: TextStyle(color: AppColors.primary)),
            ],
          ),
        ),
        const SizedBox(height: 2),
        Text(
          'TBM 활동 보고서 관리',
          style: TbmTypography.withSecondary(TbmTypography.tabSubtitle),
        ),
      ],
    );
  }
}

/*
TbmDocumentSearchBar
--------------------
Purpose:
문서 검색 입력 UI를 제공한다.

Responsibilities:
- 검색어 입력값을 상위로 전달(onChanged)
- controller를 통해 입력 상태를 유지
*/
class TbmDocumentSearchBar extends StatelessWidget {
  const TbmDocumentSearchBar({
    super.key,
    required this.controller,
    required this.onChanged,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.softBorder),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          const Icon(Icons.search, color: AppColors.textSecondary),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              decoration: const InputDecoration(
                hintText: '문서 이름 또는 관리자 검색',
                border: InputBorder.none,
              ),
              style: TbmTypography.withPrimary(
                TbmTypography.noticeBody.copyWith(fontSize: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/*
TbmDocumentPeriodSegment
------------------------
Purpose:
일간/주간 리포트 토글 세그먼트를 렌더링한다.

Responsibilities:
- 현재 선택 상태(isDaily) 시각화
- 일간/주간 선택 이벤트 위임
*/
class TbmDocumentPeriodSegment extends StatelessWidget {
  const TbmDocumentPeriodSegment({
    super.key,
    required this.isDaily,
    required this.onDailyTap,
    required this.onWeeklyTap,
  });

  final bool isDaily;
  final VoidCallback onDailyTap;
  final VoidCallback onWeeklyTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFEAF0F5),
        borderRadius: BorderRadius.circular(22),
      ),
      padding: const EdgeInsets.all(4),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: onDailyTap,
              child: Container(
                height: 60,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isDaily ? AppColors.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Text(
                  '일간 보고서',
                  style: TbmTypography.noticeBody.copyWith(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color:
                        isDaily ? AppColors.primary : AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: onWeeklyTap,
              child: Container(
                height: 60,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: !isDaily ? AppColors.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Text(
                  '주간 보고서',
                  style: TbmTypography.noticeBody.copyWith(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color:
                        !isDaily ? AppColors.primary : AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/*
TbmDocumentEmptyStateCard
-------------------------
Purpose:
문서 목록이 비어 있을 때 안내 카드를 제공한다.
*/
class TbmDocumentEmptyStateCard extends StatelessWidget {
  const TbmDocumentEmptyStateCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.softBorder),
      ),
      child: Text(
        '표시할 문서가 없습니다.',
        style: TbmTypography.withMuted(TbmTypography.noticeBody),
      ),
    );
  }
}

/*
TbmDocumentSessionCard
----------------------
Purpose:
단일 TBM 문서 카드 UI를 렌더링하고 상세/생성 액션 진입을 위임한다.

Responsibilities:
- 문서 메타 정보(title/manager/date) 표시
- 상태 뱃지 표시
- enabled 조건에 따라 tap 허용/차단
*/
class TbmDocumentSessionCard extends StatelessWidget {
  const TbmDocumentSessionCard({
    super.key,
    required this.title,
    required this.managerName,
    required this.createdDateText,
    required this.statusLabel,
    required this.statusBackground,
    required this.statusForeground,
    required this.enabled,
    required this.onTap,
  });

  final String title;
  final String managerName;
  final String createdDateText;
  final String statusLabel;
  final Color statusBackground;
  final Color statusForeground;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: enabled ? onTap : null,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFFE8EEF4)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x14000000),
              blurRadius: 12,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: const Color(0xFFFFF2F2),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.picture_as_pdf_rounded,
                color: Color(0xFFF04444),
                size: 32,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TbmTypography.withPrimary(
                            TbmTypography.tabTitle.copyWith(
                              fontSize: TbmTypography.t18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      _TbmDocumentStatusBadge(
                        label: statusLabel,
                        bg: statusBackground,
                        fg: statusForeground,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '현장 관리자: $managerName',
                    style: TbmTypography.withSecondary(
                      TbmTypography.noticeBody.copyWith(fontSize: 15),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(
                        Icons.calendar_today_rounded,
                        size: 14,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        createdDateText,
                        style: TbmTypography.withMuted(
                          TbmTypography.noticeBody.copyWith(fontSize: 14),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xFFB9C4D0),
              size: 28,
            ),
          ],
        ),
      ),
    );
  }
}

/*
_TbmDocumentStatusBadge
-----------------------
Purpose:
문서 상태 라벨을 Badge 형태로 렌더링한다.

Design Note:
- fg 색상을 기준으로 border alpha를 적용해 톤을 맞춘다.
*/
class _TbmDocumentStatusBadge extends StatelessWidget {
  const _TbmDocumentStatusBadge({
    required this.label,
    required this.bg,
    required this.fg,
  });

  final String label;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: fg.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TbmTypography.noticeBody.copyWith(
          fontWeight: FontWeight.w800,
          color: fg,
          fontSize: 12,
        ),
      ),
    );
  }
}
