import 'package:flutter/material.dart';
import 'package:tbm_application_v2/core/theme/app_typography.dart';

/// 로그인 페이지 공용 액션 버튼.
/// - 소셜 로그인/일반 로그인 CTA의 모양을 한 곳에서 통일한다.
class LoginActionButton extends StatelessWidget {
  const LoginActionButton({
    super.key,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
    required this.enabled,
    required this.leading,
    this.onPressed,
    this.borderColor,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;
  final bool enabled;
  final Widget leading;
  final VoidCallback? onPressed;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 62,
      child: ElevatedButton(
        onPressed: enabled ? onPressed : null,
        style: ElevatedButton.styleFrom(
          elevation: 0,
          disabledBackgroundColor: backgroundColor,
          disabledForegroundColor: foregroundColor,
          backgroundColor: backgroundColor,
          foregroundColor: foregroundColor,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: BorderSide(color: borderColor ?? Colors.transparent),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // leading이 빈 박스인 경우만 아이콘 슬롯을 제거해 텍스트 중앙 정렬을 유지한다.
            if (leading is! SizedBox) ...[
              SizedBox(width: 24, height: 24, child: Center(child: leading)),
              const SizedBox(width: 14),
            ],
            Text(
              label,
              style: TbmTypography.noticeBody.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: foregroundColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 현재는 비활성 상태로 노출되는 이메일/비밀번호 입력 필드.
class DisabledInputField extends StatelessWidget {
  const DisabledInputField({super.key, required this.hintText});

  final String hintText;

  @override
  Widget build(BuildContext context) {
    return TextField(
      enabled: false,
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: TbmTypography.noticeBody.copyWith(
          fontSize: 16,
          color: const Color(0xFF7C879A),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 30,
          vertical: 20,
        ),
        filled: true,
        fillColor: const Color(0xFFF6F8FB),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFFD6DCE6)),
        ),
      ),
    );
  }
}

/// 구글 로그인 버튼용 로고.
class GoogleGlyph extends StatelessWidget {
  const GoogleGlyph({super.key});

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'images/google_g_logo.jpg',
      width: 22,
      height: 22,
      fit: BoxFit.contain,
    );
  }
}

/// 카카오 로그인 버튼용 심볼.
class KakaoIcon extends StatelessWidget {
  const KakaoIcon({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        color: const Color(0xFFFEE500),
        borderRadius: BorderRadius.circular(5),
      ),
      child: const Icon(
        Icons.chat_bubble_rounded,
        size: 14,
        color: Color(0xFF111111),
      ),
    );
  }
}
