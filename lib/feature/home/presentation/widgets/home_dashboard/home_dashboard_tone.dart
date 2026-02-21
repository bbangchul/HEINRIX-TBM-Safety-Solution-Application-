import 'package:flutter/material.dart';
import 'package:tbm_application_v2/core/theme/app_typography.dart';
import 'package:tbm_application_v2/core/theme/app_colors.dart';

/// 리스트/알림/내정보 탭의 공용 카드 데이터 모델.
class HomeDashboardToneCardData {
  final String title;
  final String body;

  const HomeDashboardToneCardData({required this.title, required this.body});
}

/// 리스트/알림 탭의 공용 톤 레이아웃.
class HomeDashboardTabToneLayout extends StatelessWidget {
  const HomeDashboardTabToneLayout({
    super.key,
    required this.title,
    required this.subtitle,
    required this.cards,
  });

  final String title;
  final String subtitle;
  final List<HomeDashboardToneCardData> cards;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: TbmTypography.withPrimary(TbmTypography.tabTitle)),
        const SizedBox(height: 8),
        Text(
          subtitle,
          style: TbmTypography.withSecondary(TbmTypography.tabSubtitle),
        ),
        const SizedBox(height: 16),
        // 탭 간 시각 일관성을 위해 카드 컴포넌트를 재사용한다.
        ...cards.map((card) => HomeDashboardToneCard(data: card)),
      ],
    );
  }
}

/// 홈 대시보드 공용 정보 카드.
class HomeDashboardToneCard extends StatelessWidget {
  const HomeDashboardToneCard({super.key, required this.data});

  final HomeDashboardToneCardData data;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.softBorder),
        boxShadow: const [softShadow],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            data.title,
            style: TbmTypography.withPrimary(TbmTypography.toneCardTitle),
          ),
          const SizedBox(height: 6),
          Text(
            data.body,
            style: TbmTypography.withSecondary(TbmTypography.toneCardBody),
          ),
        ],
      ),
    );
  }
}
