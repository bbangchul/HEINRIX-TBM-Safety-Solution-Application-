import 'package:flutter/material.dart';

class AppColors {
  // Brand
  static const primary = Color(0xFF00C98B);
  static const primaryDark = Color(0xFF00A774);

  // Surfaces
  static const background = Color(0xFFF4FCF9);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0xFFEAF1FA);
  static const softBorder = Color(0xFFF0F6FF);
  static const iosSeparator = Color(0xFFD1D1D6);

  // Text / Ink
  static const textPrimary = Color(0xFF08152D);
  static const textSecondary = Color(0xFF253D66);
  static const textMuted = Color(0xFF9AACCA);

  // Status tones
  static const successBackground = Color(0xFFECFFF6);
  static const infoBackground = Color(0xFFF7F8FA);
  static const error = Color(0xFFEF4444);
}

class AppDims {
  static const screen = 16.0;
  static const cardRadius = 30.0;
  static const largeRadius = 34.0;
  static const gap8 = 8.0;
  static const gap12 = 12.0;
  static const gap16 = 16.0;
  static const gap24 = 24.0;
}

const BoxShadow softShadow = BoxShadow(
  color: Color(0x14000000),
  blurRadius: 18,
  offset: Offset(0, 8),
);
