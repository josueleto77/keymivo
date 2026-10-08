import java.util.Properties

plugins {
    id("com.android.application")
}

// Upload key lives OUTSIDE the repo. Override with -PkeymivoKeyProperties=/path/key.properties
val keyPropsFile = file((findProperty("keymivoKeyProperties") as String?)
    ?: "${System.getProperty("user.home")}/Documents/keymivo-android-keys/key.properties")
val keyProps = Properties().apply { if (keyPropsFile.exists()) keyPropsFile.inputStream().use { load(it) } }

android {
    namespace = "com.keymivo.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.keymivo.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        create("release") {
            if (keyProps.isNotEmpty()) {
                storeFile = file(keyProps.getProperty("storeFile"))
                storePassword = keyProps.getProperty("storePassword")
                keyAlias = keyProps.getProperty("keyAlias")
                keyPassword = keyProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.6.2")
}
