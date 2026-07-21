plugins {
    id("com.android.application")
}

android {
    namespace = "hu.shiftpoint.kiosk"
    compileSdk = 36

    defaultConfig {
        applicationId = "hu.shiftpoint.kiosk"
        minSdk = 26
        targetSdk = 36
        versionCode = 10
        versionName = "0.6.0-diagnostic"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

}
