# -*- coding: utf-8 -*-
"""그림 엔진 셋이 함께 쓰는 몸통 — diffusers 파이프라인 하나를 올리고 한 장 뽑습니다.

세 엔진(Qwen-Image·FLUX.1 Krea·SD 3.5 Large)은 **모델 id 와 파이프라인 클래스만**
다릅니다. 여기 한 군데에 몸통을 두는 까닭은 앱 규칙 1 과 같습니다 — 셋으로 흩어 두면
「로라를 여러 개 먹이기」 나 「시드를 돌려주기」 같은 규칙을 고칠 때 하나를 빠뜨립니다.

로라를 여러 개 먹이는 법(diffusers 규약)
    pipe.load_lora_weights(경로, adapter_name="a")
    pipe.load_lora_weights(경로, adapter_name="b")
    pipe.set_adapters(["a", "b"], adapter_weights=[0.8, 0.5])
"""

import os
import inspect
import time

import common


class ImageEngine(object):
    def __init__(
        self,
        repo,
        pipeline_name,
        default_steps,
        default_guidance,
        notes="",
        bf16_gb=24.0,
    ):
        self.repo = repo
        self.pipeline_name = pipeline_name
        self.default_steps = default_steps
        self.default_guidance = default_guidance
        self.notes = notes
        # 이 모델을 bf16 그대로 올리는 데 필요한 VRAM(GB). 정밀도를 고르는 잣대입니다.
        self.bf16_gb = bf16_gb
        self.pipe = None
        self.precision = "bf16"
        self.loaded_loras = []

    # ── 살림 ────────────────────────────────────────────────────────────
    def info(self, root):
        return {"repo": self.repo, "notes": self.notes, "bf16_gb": self.bf16_gb}

    def load(self, root, opts):
        if self.pipe is not None:
            self._apply_loras(opts)
            return
        import diffusers
        import torch  # noqa: F401  (device_and_dtype 가 씁니다)

        common.use_engine_cache(root)
        device, dtype = common.device_and_dtype()
        pipeline_class = getattr(diffusers, self.pipeline_name)
        """
        **이 GPU 에 맞는 정밀도로 올립니다.**

        여태는 아니었습니다. 늘 bf16 원본을 올리고 CPU 오프로드로 버텼는데,
        오프로드는 «안 죽게» 해 줄 뿐이라 24 GB 카드에서 26 GB 짜리를 돌리면 블록이 계속
        오가며 몇 배로 느려집니다. 이제 안 들어가면 **정말로 줄여서** 올립니다.
        """
        plan = common.plan_precision(self.bf16_gb, opts)
        self.precision = plan["mode"]
        common.log(
            "{} 를 {} 로 올립니다 (VRAM {} GB · {}).".format(
                self.repo, plan["mode"], plan["vram"], plan["why"]
            )
        )
        if plan["bits"]:
            transformer = common.quantized_component(self.repo, dtype, plan["bits"])
            pipe = pipeline_class.from_pretrained(
                self.repo, transformer=transformer, torch_dtype=dtype
            )
        else:
            pipe = pipeline_class.from_pretrained(self.repo, torch_dtype=dtype)
        pipe = common.place(pipe, device, bool(plan["bits"]))
        try:
            pipe.set_progress_bar_config(disable=True)
        except Exception:
            pass
        # 그림도 빠른 어텐션을 씁니다. 영상만큼 극적이진 않지만(시퀀스가 짧습니다) 큰 판이나
        # 여러 장을 이어 뽑을 때 그대로 시간이 됩니다. 이 PC 에 못 깔렸으면 알아서 내려갑니다.
        common.use_fast_attention(
            getattr(pipe, "transformer", None), getattr(pipe, "unet", None)
        )
        self.pipe = pipe
        self.loaded_loras = []
        self._apply_loras(opts)

    def unload(self):
        self.pipe = None
        self.loaded_loras = []
        common.free_vram()

    # ── 로라 ────────────────────────────────────────────────────────────
    def _apply_loras(self, opts):
        """`opts.loras = [{"path": "...", "weight": 0.8}, …]`. 빈 목록이면 전부 뗍니다."""
        wanted = [item for item in (opts.get("loras") or []) if item.get("path")]
        signature = [(item["path"], float(item.get("weight", 1.0))) for item in wanted]
        if signature == self.loaded_loras:
            return
        try:
            self.pipe.unload_lora_weights()
        except Exception as error:
            common.log("로라를 떼지 못했습니다(무시): {}".format(error))
        names, weights = [], []
        for index, item in enumerate(wanted):
            path = item["path"]
            if not os.path.isfile(path):
                raise IOError("로라 파일을 찾지 못했습니다: {}".format(path))
            name = "lora{}".format(index)
            folder, filename = os.path.split(path)
            self.pipe.load_lora_weights(folder, weight_name=filename, adapter_name=name)
            names.append(name)
            weights.append(float(item.get("weight", 1.0)))
        if names:
            self.pipe.set_adapters(names, adapter_weights=weights)
            common.log("로라 {}개를 먹였습니다: {}".format(len(names), ", ".join(names)))
        self.loaded_loras = signature

    # ── 생성 ────────────────────────────────────────────────────────────
    def generate(self, output, opts, report):
        started = time.time()
        steps = int(opts.get("steps") or self.default_steps)
        guidance = float(opts.get("guidance") or self.default_guidance)
        width = int(opts.get("width") or 1536)
        height = int(opts.get("height") or 864)
        seed = common.resolve_seed(opts)

        kwargs = {
            "prompt": opts.get("prompt") or "",
            "num_inference_steps": steps,
            "width": width,
            "height": height,
            "generator": common.generator(seed),
            "callback_on_step_end": common.step_reporter(report, steps),
        }
        # 네거티브를 받지 않는 파이프라인이 있어 있을 때만 넣습니다.
        negative = (opts.get("negative") or "").strip()
        if negative:
            kwargs["negative_prompt"] = negative
        if guidance > 0:
            kwargs["true_cfg_scale" if self.pipeline_name.startswith("QwenImage") else "guidance_scale"] = guidance

        """
        **긴 프롬프트가 조용히 잘리던 것.**

        파이프라인은 텍스트 인코더의 기본 길이(Qwen-Image 는 512 토큰)만 읽고 나머지를 버립니다.
        우리 프롬프트는 상황·환경·인물·구도·빛을 다 적어 길고, **칸 배치 지시가 맨 뒤**에 있어서
        정확히 그 부분이 날아갔습니다 — 시트를 시켰는데 전혀 다른 그림이 나온 까닭입니다.
        받아 주는 파이프라인에는 길이를 명시하고, 그래도 넘치면 결과에 적어 화면이 알 수 있게 합니다.
        """
        try:
            accepts = inspect.signature(self.pipe.__call__).parameters
        except (TypeError, ValueError):
            accepts = {}
        budget = int(opts.get("max_tokens") or 1024)
        if "max_sequence_length" in accepts:
            kwargs["max_sequence_length"] = budget
        # 토큰 수는 인코더마다 다르지만, 영어는 낱말 하나에 1.3 토큰쯤입니다 — 넘치는지만 알면 됩니다.
        words = len((kwargs["prompt"] or "").split())
        rough_tokens = int(words * 1.3)
        if rough_tokens > budget:
            common.log(
                "프롬프트가 깁니다 — 낱말 {}개(약 {} 토큰), 이 모델의 한 번 한도는 {} 토큰입니다. "
                "뒤쪽이 잘릴 수 있습니다.".format(words, rough_tokens, budget)
            )

        result = common.run_attention_safe(self.pipe, lambda: self.pipe(**kwargs))
        image = result.images[0]
        image.save(output)
        return {
            "width": image.width,
            "height": image.height,
            "seed": seed,
            "steps": steps,
            # 어떤 정밀도로 돌았는지 결과에 남깁니다 — 「왜 이번엔 결이 다르지」 의 답이 여기 있습니다.
            "precision": self.precision,
            "generate_seconds": round(time.time() - started, 2),
            # 프롬프트가 한도를 넘었는지 — 화면이 「뒤쪽이 잘렸을 수 있습니다」 를 말해 줄 근거.
            "prompt_words": words,
            "prompt_budget": budget,
            "prompt_overflow": rough_tokens > budget,
        }
