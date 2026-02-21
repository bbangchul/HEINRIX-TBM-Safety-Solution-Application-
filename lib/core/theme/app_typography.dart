import 'package:flutter/material.dart';

import 'app_colors.dart';

/// App typography 규격 (TBM)
/// - 기본 폰트: NotoSansKR (pubspec.yaml에 등록되어 있어야 함)
/// - 모든 화면에서 이 파일만 참조하도록 고정
class TbmTypography {
  const TbmTypography._();

  // Font sizes
  static const double h22 = 22;
  static const double h30 = 30;
  static const double t20 = 20;
  static const double t18 = 18;
  static const double t16 = 16;
  static const double b14 = 14;
  static const double c12 = 12;

  // Font weights
  static const FontWeight w700 = FontWeight.w700;
  static const FontWeight w600 = FontWeight.w600;
  static const FontWeight w500 = FontWeight.w500;
  static const FontWeight w400 = FontWeight.w400;

  // Line heights (대략적인 가독성 기준)
  static const double lhTight = 1.15;
  static const double lhNormal = 1.30;
  static const double lhRelax = 1.45;

  /// 앱 공통 TextTheme
  static TextTheme theme({String fontFamily = 'NotoSansKR'}) => TextTheme(
    headlineSmall: TextStyle(
      fontFamily: fontFamily,
      fontSize: h22,
      fontWeight: w700,
      height: lhTight,
    ),
    titleLarge: TextStyle(
      fontFamily: fontFamily,
      fontSize: t18,
      fontWeight: w700,
      height: lhNormal,
    ),
    titleMedium: TextStyle(
      fontFamily: fontFamily,
      fontSize: t16,
      fontWeight: w700,
      height: lhNormal,
    ),
    bodyMedium: TextStyle(
      fontFamily: fontFamily,
      fontSize: b14,
      fontWeight: w500,
      height: lhRelax,
    ),
    bodySmall: TextStyle(
      fontFamily: fontFamily,
      fontSize: c12,
      fontWeight: w400,
      height: lhRelax,
    ),
  );

  // Home/top app bar
  static const TextStyle homeLogo = TextStyle(
    fontSize: 27,
    fontWeight: FontWeight.w800,
  );

  // Home screen section and status
  static const TextStyle homeSectionTitle = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w700,
  );
  static const TextStyle homeStatusChip = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
  );
  static const TextStyle homeCta = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w700,
  );

  // Bottom nav
  static const TextStyle navLabel = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
  );

  // Supervisor card
  static const TextStyle supervisorRole = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w500,
  );
  static const TextStyle supervisorName = TextStyle(
    fontSize: 26,
    height: 1.0,
    fontWeight: FontWeight.w700,
  );
  static const TextStyle supervisorInfoLabel = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
  );
  static const TextStyle supervisorInfoValue = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
  );

  // Notice cards
  static const TextStyle noticeTitle = TextStyle(
    fontSize: 18,
    height: 1.0,
    fontWeight: FontWeight.w700,
  );
  static const TextStyle noticeNumber = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
  );
  static const TextStyle noticeBody = TextStyle(
    fontSize: 16,
    height: 1.3,
    fontWeight: FontWeight.w500,
  );
  static const TextStyle noticeHighlight = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    decoration: TextDecoration.underline,
  );

  // Secondary tab pages
  static const TextStyle tabTitle = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w700,
  );
  static const TextStyle tabSubtitle = TextStyle(
    fontSize: 15,
    height: 1.45,
    fontWeight: FontWeight.w500,
  );
  static const TextStyle toneCardTitle = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
  );
  static const TextStyle toneCardBody = TextStyle(
    fontSize: 15,
    height: 1.4,
    fontWeight: FontWeight.w500,
  );

  // Semantic color helpers to keep UI files readable.
  static TextStyle withPrimary(TextStyle base) =>
      base.copyWith(color: AppColors.textPrimary);
  static TextStyle withSecondary(TextStyle base) =>
      base.copyWith(color: AppColors.textSecondary);
  static TextStyle withMuted(TextStyle base) =>
      base.copyWith(color: AppColors.textMuted);
  static TextStyle withBrand(TextStyle base) =>
      base.copyWith(color: AppColors.primary);
}
