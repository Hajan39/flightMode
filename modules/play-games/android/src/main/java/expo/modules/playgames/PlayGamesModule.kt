package expo.modules.playgames

import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Thin bridge over the Google Play Games Services **v2** SDK.
 *
 * Exposed to JS as the native module "PlayGames" and consumed by
 * `utils/playGames.ts` via `requireNativeModule("PlayGames")`. Android-only:
 * on iOS/web/Expo Go the module isn't present and the JS wrapper no-ops.
 *
 * Contract: every method is defensive. When there's no current Activity (app
 * backgrounded, etc.) sign-in resolves false and the fire-and-forget calls
 * resolve without throwing, so a PGS hiccup never breaks the local (offline)
 * achievement flow that drives these calls.
 */
class PlayGamesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PlayGames")

    OnCreate {
      // v2 also auto-initializes from the APP_ID manifest metadata, but calling
      // this explicitly is safe and makes intent clear.
      appContext.reactContext?.let { PlayGamesSdk.initialize(it) }
    }

    AsyncFunction("isAuthenticated") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      PlayGames.getGamesSignInClient(activity).isAuthenticated
        .addOnCompleteListener { task ->
          promise.resolve(task.isSuccessful && task.result?.isAuthenticated == true)
        }
    }

    AsyncFunction("signInSilently") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      val client = PlayGames.getGamesSignInClient(activity)
      client.isAuthenticated.addOnCompleteListener { task ->
        if (task.isSuccessful && task.result?.isAuthenticated == true) {
          promise.resolve(true)
        } else {
          // Not yet authenticated — attempt an interactive/one-tap sign-in.
          client.signIn().addOnCompleteListener { res ->
            promise.resolve(res.isSuccessful && res.result?.isAuthenticated == true)
          }
        }
      }
    }

    AsyncFunction("unlockAchievement") { playId: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      // unlock() is fire-and-forget on the SDK side; it silently no-ops if the
      // player isn't signed in, so we don't gate on auth here.
      PlayGames.getAchievementsClient(activity).unlock(playId)
      promise.resolve(null)
    }

    AsyncFunction("incrementAchievement") { playId: String, steps: Int, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      PlayGames.getAchievementsClient(activity).increment(playId, steps)
      promise.resolve(null)
    }

    AsyncFunction("showAchievements") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      PlayGames.getAchievementsClient(activity).achievementsIntent
        .addOnSuccessListener { intent ->
          activity.startActivity(intent)
          promise.resolve(null)
        }
        .addOnFailureListener { e ->
          promise.reject(
            "ERR_SHOW_ACHIEVEMENTS",
            e.message ?: "Failed to open the Play Games achievements overlay",
            e,
          )
        }
    }
  }
}
