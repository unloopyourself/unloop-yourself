plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "io.github.unloopyourself.dummytarget"
  compileSdk = 34

  defaultConfig {
    applicationId = "io.github.unloopyourself.dummytarget"
    minSdk = 26
    targetSdk = 34
    versionCode = 1
    versionName = "0.1.0"
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions {
    jvmTarget = "17"
  }
  buildTypes {
    release {
      isMinifyEnabled = false
    }
  }
}

dependencies {
  implementation("androidx.appcompat:appcompat:1.7.0")
}
