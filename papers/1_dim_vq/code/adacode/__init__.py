"""
AdaCode: Distribution-Adaptive Codebook Learning for 1D Vector Quantization of LLM Weights

This module implements adaptive quantization techniques for LLM weights, including:
- AdaCode: GGD-based adaptive codebook
- CFHQ: Closed-form Hessian quantization
- Dynamic Codebook: Activation-conditioned quantization (B1)
- Hierarchical Quantization: Structure-aware layered quantization (B2)
- Unified Quantizer: Combined B1 + B2 approach
"""

from .codebook import AdaCodebook, compute_optimal_codebook
from .quantizer import (
    AdaCodeQuantizer,
    RiskAwareCodebookRouter,
    quantize_model_weights,
    compute_layer_betas,
)
from .method2_actadacode import (
    ActAdaCodeConfig,
    collect_activation_second_moments,
    train_actadacode_layer,
    quantize_model_method2,
)
from .ggd import estimate_ggd_params, ggd_pdf, ggd_cdf

# Existing innovation direction modules
from .robustcode import (
    RobustCodeQuantizer,
    compute_dro_beta,
    compute_auto_epsilon,
    beta_uncertainty,
    dro_gamma_from_epsilon,
    quantize_model_robustcode,
)
from .hessian_codebook import (
    HessianCodebookQuantizer,
    importance_weighted_ggd_params,
    compute_activation_importance_weights,
)
from .rdp_tradeoff import (
    RDPQuantizer,
    compute_rdp_gap,
)

# B1: Dynamic Codebook (Activation-Conditioned)
from .dynamic_codebook import (
    DynamicCodebookMixer,
    ActivationStatisticsCollector,
    CodebookConfig,
    create_dynamic_codebook_quantizer,
)

# B2: Hierarchical Quantization (Structure-Aware)
from .hierarchical_quantizer import (
    HierarchicalQuantizer,
    AdaptiveHierarchicalQuantizer,
    HierarchicalQuantConfig,
    VarianceEstimator,
)

# Unified Quantizer (B1 + B2)
from .unified_quantizer import (
    UnifiedAdaptiveQuantizer,
    UnifiedQuantizerConfig,
    create_unified_quantizer,
)

__version__ = "0.3.0"
